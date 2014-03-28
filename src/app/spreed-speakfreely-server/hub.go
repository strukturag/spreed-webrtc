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
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/gorilla/securecookie"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

const (
	turnTTL               = 3600 // XXX(longsleep): Add to config file.
	maxBroadcastPerSecond = 1000
	maxUsersLength        = 5000
)

type MessageRequest struct {
	From    string
	To      string
	Message Buffer
	Id      string
}

type HubStat struct {
	Rooms                 int                  `json:"rooms"`
	Connections           int                  `json:"connections"`
	Users                 int                  `json:"users"`
	Count                 uint64               `json:"count"`
	BroadcastChatMessages uint64               `json:"broadcastchatmessages"`
	UnicastChatMessages   uint64               `json:"unicastchatmessages"`
	IdsInRoom             map[string][]string  `json:"idsinroom,omitempty"`
	UsersById             map[string]*DataUser `json:"usersbyid,omitempty"`
	ConnectionsByIdx      map[string]string    `json:"connectionsbyidx,omitempty"`
}

type Hub struct {
	server                *Server
	connectionTable       map[string]*Connection
	userTable             map[string]*User
	roomTable             map[string]*RoomWorker
	version               string
	config                *Config
	sessionSecret         []byte
	turnSecret            []byte
	turnUsernameFormat    string
	tickets               *securecookie.SecureCookie
	count                 uint64
	mutex                 sync.RWMutex
	buffers               BufferCache
	broadcastChatMessages uint64
	unicastChatMessages   uint64
}

func NewHub(version string, config *Config, sessionSecret, turnSecret, turnUsernameFormat string) *Hub {

	h := &Hub{
		connectionTable:    make(map[string]*Connection),
		userTable:          make(map[string]*User),
		roomTable:          make(map[string]*RoomWorker),
		version:            version,
		config:             config,
		sessionSecret:      []byte(sessionSecret),
		turnSecret:         []byte(turnSecret),
		turnUsernameFormat: turnUsernameFormat,
	}

	h.tickets = securecookie.New(h.sessionSecret, nil)
	h.buffers = NewBufferCache(1024, bytes.MinRead)
	return h

}

func (h *Hub) Stat(details bool) *HubStat {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	stat := &HubStat{
		Rooms:       len(h.roomTable),
		Connections: len(h.connectionTable),
		Users:       len(h.userTable),
		Count:       h.count,
		BroadcastChatMessages: atomic.LoadUint64(&h.broadcastChatMessages),
		UnicastChatMessages:   atomic.LoadUint64(&h.unicastChatMessages),
	}
	if details {
		rooms := make(map[string][]string)
		for roomid, room := range h.roomTable {
			users := make([]string, 0, len(room.connections))
			for id, _ := range room.connections {
				users = append(users, id)
			}
			rooms[roomid] = users
		}
		stat.IdsInRoom = rooms
		users := make(map[string]*DataUser)
		for userid, user := range h.userTable {
			users[userid] = user.Data()
		}
		stat.UsersById = users
		connections := make(map[string]string)
		for id, connection := range h.connectionTable {
			connections[fmt.Sprintf("%d", connection.Idx)] = id
		}
		stat.ConnectionsByIdx = connections
	}
	return stat
}

func (h *Hub) CreateTurnData(id string) *DataTurn {

	// Create turn data credentials for shared secret auth with TURN
	// server. See http://tools.ietf.org/html/draft-uberti-behave-turn-rest-00
	// and https://code.google.com/p/rfc5766-turn-server/ REST API auth
	// and set shared secret in TURN server with static-auth-secret.
	if len(h.turnSecret) == 0 {
		return &DataTurn{}
	}
	var user string
	bar := sha256.New()
	bar.Write([]byte(id))
	id = base64.StdEncoding.EncodeToString(bar.Sum(nil))
	foo := hmac.New(sha1.New, h.turnSecret)
	expiration := int32(time.Now().Unix())+turnTTL
	switch h.turnUsernameFormat {
	case "time:id":
		user = fmt.Sprintf("%d:%s", expiration, id)
	default:
		user = fmt.Sprintf("%s:%d", id, expiration)
	}
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
		// need to re-check, another thread might have created the room
		// while we waited for the lock
		room, ok = h.roomTable[id]
		if !ok {
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
			h.mutex.Unlock()
		}
	} else {
		h.mutex.RUnlock()
	}

	return room

}

func (h *Hub) GetGlobalConnections() []*Connection {

	if h.config.globalRoomid == "" {
		return make([]*Connection, 0)
	}
	h.mutex.RLock()
	if room, ok := h.roomTable[h.config.globalRoomid]; ok {
		h.mutex.RUnlock()
		return room.GetConnections()
	} else {
		h.mutex.RUnlock()
	}
	return make([]*Connection, 0)

}

func (h *Hub) RunForAllRooms(f func(room *RoomWorker)) {

	h.mutex.RLock()
	for _, room := range h.roomTable {
		f(room)
	}
	h.mutex.RUnlock()

}

func (h *Hub) isGlobalRoomid(id string) bool {

	return id != "" && (id == h.config.globalRoomid)

}

func (h *Hub) isDefaultRoomid(id string) bool {

	return id == ""
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
		//log.Printf("Register (%d) from %s: %s (existing)\n", c.Idx, c.RemoteAddr, c.Id)
	} else {
		h.connectionTable[c.Id] = c
		//fmt.Println("registered", c.Id)
		h.mutex.Unlock()
		//log.Printf("Register (%d) from %s: %s\n", c.Idx, c.RemoteAddr, c.Id)
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
	//log.Printf("Unregister (%d) from %s: %s\n", c.Idx, c.RemoteAddr, c.Id)
	h.server.OnUnregister(c)

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

func (h *Hub) aliveHandler(c *Connection, alive *DataAlive) {

	aliveJson := h.buffers.New()
	encoder := json.NewEncoder(aliveJson)
	err := encoder.Encode(&DataOutgoing{From: c.Id, Data: alive})
	if err != nil {
		log.Println("Alive error while encoding JSON", err)
		aliveJson.Decref()
		return
	}
	c.send(aliveJson)
	aliveJson.Decref()

}

func (h *Hub) userupdateHandler(u *UserUpdate) uint64 {

	//fmt.Println("Userupdate", u)
	h.mutex.RLock()
	user, ok := h.userTable[u.Id]
	h.mutex.RUnlock()
	var rev uint64
	if ok {
		rev = user.Update(u)
	} else {
		log.Printf("Update data for unknown user %s\n", u.Id)
	}
	return rev

}
