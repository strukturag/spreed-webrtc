/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/gorilla/securecookie"
	"log"
	"sync"
	"time"
)

const (
	globalRoomId          = "global"
	turnTTL               = 3600 // XXX(longsleep): Add to config file.
	maxBroadcastPerSecond = 1000
	maxUsersLength        = 5000
)

type MessageRequest struct {
	From    string
	To      string
	Message []byte
	Id      string
}

type Hub struct {
	server          *Server
	connectionTable map[string]*Connection
	userTable       map[string]*User
	roomTable       map[string]*RoomWorker
	version         string
	config          *Config
	sessionSecret   []byte
	turnSecret      []byte
	tickets         *securecookie.SecureCookie
	count           uint64
	mutex           sync.RWMutex
}

func NewHub(version string, config *Config, sessionSecret string, turnSecret string) *Hub {

	h := &Hub{
		connectionTable: make(map[string]*Connection),
		userTable:       make(map[string]*User),
		roomTable:       make(map[string]*RoomWorker),
		version:         version,
		config:          config,
		sessionSecret:   []byte(sessionSecret),
		turnSecret:      []byte(turnSecret),
	}

	h.tickets = securecookie.New(h.sessionSecret, nil)
	return h

}

func (h *Hub) CreateTurnData(id string) *DataTurn {

	// Create turn data credentials for shared secret auth with TURN
	// server. See http://tools.ietf.org/html/draft-uberti-behave-turn-rest-00
	// and https://code.google.com/p/rfc5766-turn-server/ REST API auth
	// and set shared secret in TURN server with static-auth-secret.
	if len(h.turnSecret) == 0 {
		return &DataTurn{}
	}
	foo := hmac.New(sha1.New, h.turnSecret)
	user := fmt.Sprintf("%s:%d", id, int32(time.Now().Unix()))
	foo.Write([]byte(user))
	password := base64.StdEncoding.EncodeToString(foo.Sum(nil))
	return &DataTurn{user, password, turnTTL, h.config.TurnURIs}

}

func (h *Hub) EncodeTicket(key, value string) (string, error) {

	if value == "" {
		// Create new id.
		value = fmt.Sprintf("%s", securecookie.GenerateRandomKey(16))
	}
	return h.tickets.Encode(key, value)

}

func (h *Hub) DecodeTicket(key, value string) (string, error) {

	result := ""
	err := h.tickets.Decode(key, value, &result)
	return result, err

}

func (h *Hub) GetRoom(id string) *RoomWorker {

	h.mutex.RLock()
	room, ok := h.roomTable[id]
	if !ok {
		h.mutex.RUnlock()
		h.mutex.Lock()
		room = NewRoomWorker(h, id)
		h.roomTable[id] = room
		h.mutex.Unlock()
		go func() {
			// Start room, this blocks until room expired.
			room.Start()
			// Cleanup room when we are done.
			h.mutex.Lock()
			defer h.mutex.Unlock()
			delete(h.roomTable, id)
			log.Printf("Cleaned up room '%s'\n", id)
		}()
	} else {
		h.mutex.RUnlock()
	}

	return room

}

func (h *Hub) registerHandler(c *Connection) {

	h.mutex.Lock()

	// Create new user instance.
	h.count++
	c.Idx = h.count
	u := &User{Id: c.Id}
	h.userTable[c.Id] = u
	c.User = u
	c.IsRegistered = true

	// Register connection or replace existing one.
	if ec, ok := h.connectionTable[c.Id]; ok {
		delete(h.connectionTable, ec.Id)
		ec.IsRegistered = false
		ec.close()
		h.connectionTable[c.Id] = c
		h.mutex.Unlock()
		log.Printf("Register (%d) from %s: %s (existing)\n", c.Idx, c.RemoteAddr, c.Id)
	} else {
		h.connectionTable[c.Id] = c
		//fmt.Println("registered", c.Id)
		h.mutex.Unlock()
		log.Printf("Register (%d) from %s: %s\n", c.Idx, c.RemoteAddr, c.Id)
		h.server.OnRegister(c)
	}

}

func (h *Hub) unregisterHandler(c *Connection) {

	h.mutex.Lock()
	if !c.IsRegistered {
		h.mutex.Unlock()
		return
	}
	c.close()
	delete(h.connectionTable, c.Id)
	delete(h.userTable, c.Id)
	h.mutex.Unlock()
	log.Printf("Unregister (%d) from %s: %s\n", c.Idx, c.RemoteAddr, c.Id)
	h.server.OnUnregister(c)

}

func (h *Hub) broadcastHandler(m *MessageRequest) {

	h.mutex.RLock()

	//fmt.Println("in h.broadcast", h.userTable, h.connectionTable)
	roomid := m.Id
	users := make([]string, len(h.userTable))
	i := 0
	for id, u := range h.userTable {
		if id == m.From || (u.Roomid != roomid && roomid != globalRoomId) {
			// Skip self and users not in the correct room.
			continue
		}
		users[i] = id
		i++
	}
	h.mutex.RUnlock()

	room := h.GetRoom(roomid)
	worker := func() {

		for _, id := range users {
			h.mutex.RLock()
			u, ok := h.userTable[id]
			if !ok {
				// User gone.
				h.mutex.RUnlock()
				continue
			}
			ec, ok := h.connectionTable[id]
			if !ok {
				// Connection gone
				h.mutex.RUnlock()
				continue
			}
			userRoomid := u.Roomid
			//fmt.Println("in h.broadcast id", id, m.From, userRoomid, roomid)
			//fmt.Println("broadcasting to", id, ec.Idx, userRoomid, roomid)
			h.mutex.RUnlock()
			if userRoomid != roomid && roomid != globalRoomId {
				// Skip other rooms.
				continue
			}
			//fmt.Printf("%s\n", m.Message)
			ec.send(m.Message)
		}

	}

	// Run worker in room.
	if !room.Run(worker) {
		// This handles the case that the room was cleaned up while we retrieved.
		room = h.GetRoom(roomid)
		room.Run(worker)
	}

}

func (h *Hub) unicastHandler(m *MessageRequest) {

	h.mutex.RLock()
	out, ok := h.connectionTable[m.To]
	h.mutex.RUnlock()
	if !ok {
		log.Println("Unicast To not found", m.To)
		return
	}
	out.send(m.Message)

}

func (h *Hub) usersHandler(c *Connection) {

	h.mutex.RLock()
	users := &DataUsers{Type: "Users", Index: 0, Batch: 0}
	usersList := users.Users
	roomid := c.User.Roomid
	for id, u := range h.userTable {
		if u.Roomid == roomid || u.Roomid == globalRoomId {
			user := &DataUser{Type: "Online", Id: id, Ua: u.Ua, Status: u.Status, Rev: u.UpdateRev}
			usersList = append(usersList, user)
			if len(usersList) >= maxUsersLength {
				log.Println("Limiting users response length in channel", roomid)
				break
			}
		}
	}
	h.mutex.RUnlock()
	users.Users = usersList
	usersJson, err := json.Marshal(&DataOutgoing{From: c.Id, Data: users})
	if err != nil {
		log.Println("Users error while encoding JSON", err)
		return
	}
	c.send(usersJson)

}

func (h *Hub) aliveHandler(c *Connection, alive *DataAlive) {

	aliveJson, err := json.Marshal(&DataOutgoing{From: c.Id, Data: alive})
	if err != nil {
		log.Println("Alive error while encoding JSON", err)
		return
	}
	c.send(aliveJson)

}

func (h *Hub) userupdateHandler(u *UserUpdate) uint64 {

	//fmt.Println("Userupdate", u)
	h.mutex.RLock()
	user, ok := h.userTable[u.Id]
	h.mutex.RUnlock()
	var rev uint64
	if ok {
		h.mutex.Lock()
		rev = user.Update(u)
		h.mutex.Unlock()
	} else {
		log.Printf("Update data for unknown user %s\n", u.Id)
	}
	return rev

}
