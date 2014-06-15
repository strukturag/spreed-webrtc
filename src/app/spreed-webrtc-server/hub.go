/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed WebRTC.
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
	"crypto/aes"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/securecookie"
	"log"
	"net/http"
	"strings"
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
	Rooms                 int                     `json:"rooms"`
	Connections           int                     `json:"connections"`
	Sessions              int                     `json:"sessions"`
	Users                 int                     `json:"users"`
	Count                 uint64                  `json:"count"`
	BroadcastChatMessages uint64                  `json:"broadcastchatmessages"`
	UnicastChatMessages   uint64                  `json:"unicastchatmessages"`
	IdsInRoom             map[string][]string     `json:"idsinroom,omitempty"`
	SessionsById          map[string]*DataSession `json:"sessionsbyid,omitempty"`
	UsersById             map[string]*DataUser    `json:"usersbyid,omitempty"`
	ConnectionsByIdx      map[string]string       `json:"connectionsbyidx,omitempty"`
}

type Hub struct {
	server                *Server
	connectionTable       map[string]*Connection
	sessionTable          map[string]*Session
	roomTable             map[string]*RoomWorker
	userTable             map[string]*User
	version               string
	config                *Config
	sessionSecret         []byte
	encryptionSecret      []byte
	turnSecret            []byte
	tickets               *securecookie.SecureCookie
	count                 uint64
	mutex                 sync.RWMutex
	buffers               BufferCache
	broadcastChatMessages uint64
	unicastChatMessages   uint64
	buddyImages           ImageCache
	realm                 string
	tokenName             string
	useridRetriever       func(*http.Request) (string, error)
	contacts              *securecookie.SecureCookie
}

func NewHub(version string, config *Config, sessionSecret, encryptionSecret, turnSecret, realm string) *Hub {

	h := &Hub{
		connectionTable:  make(map[string]*Connection),
		sessionTable:     make(map[string]*Session),
		roomTable:        make(map[string]*RoomWorker),
		userTable:        make(map[string]*User),
		version:          version,
		config:           config,
		sessionSecret:    []byte(sessionSecret),
		encryptionSecret: []byte(encryptionSecret),
		turnSecret:       []byte(turnSecret),
		realm:            realm,
	}

	if len(h.sessionSecret) < 32 {
		log.Printf("Weak sessionSecret (only %d bytes). It is recommended to use a key with 32 or 64 bytes.\n", len(h.sessionSecret))
	}

	h.tickets = securecookie.New(h.sessionSecret, h.encryptionSecret)
	h.tickets.MaxAge(86400 * 30) // 30 days
	h.tickets.HashFunc(sha256.New)
	h.tickets.BlockFunc(aes.NewCipher)
	h.buffers = NewBufferCache(1024, bytes.MinRead)
	h.buddyImages = NewImageCache()
	h.tokenName = fmt.Sprintf("token@%s", h.realm)
	h.contacts = securecookie.New(h.sessionSecret, h.encryptionSecret)
	h.contacts.MaxAge(0)
	h.contacts.HashFunc(sha256.New)
	h.contacts.BlockFunc(aes.NewCipher)
	return h

}

func (h *Hub) Stat(details bool) *HubStat {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	stat := &HubStat{
		Rooms:       len(h.roomTable),
		Connections: len(h.connectionTable),
		Sessions:    len(h.sessionTable),
		Users:       len(h.userTable),
		Count:       h.count,
		BroadcastChatMessages: atomic.LoadUint64(&h.broadcastChatMessages),
		UnicastChatMessages:   atomic.LoadUint64(&h.unicastChatMessages),
	}
	if details {
		rooms := make(map[string][]string)
		for roomid, room := range h.roomTable {
			sessions := make([]string, 0, len(room.connections))
			for id := range room.connections {
				sessions = append(sessions, id)
			}
			rooms[roomid] = sessions
		}
		stat.IdsInRoom = rooms
		sessions := make(map[string]*DataSession)
		for sessionid, session := range h.sessionTable {
			sessions[sessionid] = session.Data()
		}
		stat.SessionsById = sessions
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
	bar := sha256.New()
	bar.Write([]byte(id))
	id = base64.StdEncoding.EncodeToString(bar.Sum(nil))
	foo := hmac.New(sha1.New, h.turnSecret)
	expiration := int32(time.Now().Unix()) + turnTTL
	user := fmt.Sprintf("%d:%s", expiration, id)
	foo.Write([]byte(user))
	password := base64.StdEncoding.EncodeToString(foo.Sum(nil))
	return &DataTurn{user, password, turnTTL, h.config.TurnURIs}

}

func (h *Hub) CreateSuserid(session *Session) (suserid string) {
	if session.Userid != "" {
		m := hmac.New(sha256.New, h.encryptionSecret)
		m.Write([]byte(session.Userid))
		suserid = base64.StdEncoding.EncodeToString(m.Sum(nil))
	}
	return suserid
}

func (h *Hub) CreateSession(request *http.Request, st *SessionToken) *Session {

	// NOTE(longsleep): Is it required to make this a secure cookie,
	// random data in itself should be sufficent if we do not validate
	// session ids somewhere?

	var session *Session
	var userid string
	usersEnabled := h.config.UsersEnabled

	if usersEnabled && h.useridRetriever != nil {
		userid, _ = h.useridRetriever(request)
	}

	if st == nil {
		sid := NewRandomString(32)
		id, _ := h.tickets.Encode("id", sid)
		session = NewSession(id, sid)
		log.Println("Created new session id", len(id), id, sid)
	} else {
		if userid == "" {
			userid = st.Userid
		}
		if !usersEnabled {
			userid = ""
		}
		session = NewSession(st.Id, st.Sid)
	}

	if userid != "" {
		h.authenticateHandler(session, st, userid)
	}

	return session

}

func (h *Hub) ValidateSession(id, sid string) bool {

	var decoded string
	err := h.tickets.Decode("id", id, &decoded)
	if err != nil {
		log.Println("Session validation error", err, id, sid)
		return false
	}
	if decoded != sid {
		log.Println("Session validation failed", id, sid)
		return false
	}
	return true

}

func (h *Hub) EncodeSessionToken(st *SessionToken) (string, error) {

	return h.tickets.Encode(h.tokenName, st)

}

func (h *Hub) DecodeSessionToken(token string) (*SessionToken, error) {

	st := &SessionToken{}
	err := h.tickets.Decode(h.tokenName, token, st)
	return st, err

}

func (h *Hub) GetRoom(id string) *RoomWorker {

	h.mutex.RLock()
	room, ok := h.roomTable[id]
	if !ok {
		h.mutex.RUnlock()
		h.mutex.Lock()
		// Need to re-check, another thread might have created the room
		// while we waited for the lock.
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
	}

	h.mutex.RUnlock()
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

func (h *Hub) registerHandler(c *Connection, s *Session) {

	// Apply session to connection.
	c.Id = s.Id
	c.Session = s

	h.mutex.Lock()

	// Set flags.
	h.count++
	c.Idx = h.count
	c.IsRegistered = true

	// Register connection or replace existing one.
	if ec, ok := h.connectionTable[c.Id]; ok {
		ec.IsRegistered = false
		ec.close()
		//log.Printf("Register (%d) from %s: %s (existing)\n", c.Idx, c.Id)
	}

	h.connectionTable[c.Id] = c
	h.sessionTable[c.Id] = s
	//fmt.Println("registered", c.Id)
	h.mutex.Unlock()
	//log.Printf("Register (%d) from %s: %s\n", c.Idx, c.Id)
	h.server.OnRegister(c)

}

func (h *Hub) unregisterHandler(c *Connection) {

	h.mutex.Lock()
	if !c.IsRegistered {
		h.mutex.Unlock()
		return
	}
	session := c.Session
	delete(h.connectionTable, c.Id)
	delete(h.sessionTable, c.Id)
	if session != nil && session.Userid != "" {
		user, ok := h.userTable[session.Userid]
		if ok {
			empty := user.RemoveSession(session)
			if empty {
				delete(h.userTable, session.Userid)
			}
		}
	}
	h.mutex.Unlock()
	if session != nil {
		h.buddyImages.Delete(session.Id)
	}
	//log.Printf("Unregister (%d) from %s: %s\n", c.Idx, c.RemoteAddr, c.Id)
	h.server.OnUnregister(c)
	c.close()

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

func (h *Hub) sessionsHandler(c *Connection, sessions *DataSessions) {

	reply := false

	switch sessions.Type {
	case "contact":
		contact := &Contact{}
		err := h.contacts.Decode("contactConfirmed", sessions.Token, contact)
		if err != nil {
			log.Println("Failed to decode incoming contact token", err)
			return
		}
		if contact.A != c.Session.Userid && contact.B != c.Session.Userid {
			log.Println("Ignoring foreign contact token")
			return
		}
		h.mutex.RLock()
		defer h.mutex.RUnlock()
		user, ok := h.userTable[c.Session.Userid]
		if !ok {
			return
		}
		sessions.Users = user.SessionsData()
		reply = true
	default:
		log.Println("Unkown incoming sessions request type", sessions.Type)
	}

	if reply {

		sessionsJson := h.buffers.New()
		encoder := json.NewEncoder(sessionsJson)
		err := encoder.Encode(&DataOutgoing{From: c.Id, Data: sessions})
		if err != nil {
			log.Println("Sessions error while encoding JSON", err)
			sessionsJson.Decref()
			return
		}
		c.send(sessionsJson)
		sessionsJson.Decref()

	}

}

func (h *Hub) sessionupdateHandler(s *SessionUpdate) uint64 {

	//fmt.Println("Userupdate", u)
	h.mutex.RLock()
	session, ok := h.sessionTable[s.Id]
	h.mutex.RUnlock()
	var rev uint64
	if ok {
		rev = session.Update(s)
		if s.Status != nil {
			status, ok := s.Status.(map[string]interface{})
			if ok && status["buddyPicture"] != nil {
				pic := status["buddyPicture"].(string)
				if strings.HasPrefix(pic, "data:") {
					imageId := h.buddyImages.Update(s.Id, pic[5:])
					if imageId != "" {
						status["buddyPicture"] = "img:" + imageId
					}
				}
			}
		}
	} else {
		log.Printf("Update data for unknown user %s\n", s.Id)
	}
	return rev

}

func (h *Hub) sessiontokenHandler(st *SessionToken) (string, error) {

	h.mutex.RLock()
	c, ok := h.connectionTable[st.Id]
	h.mutex.RUnlock()

	if !ok {
		return "", errors.New("no such connection")
	}

	nonce, err := c.Session.Authorize(h.realm, st)
	if err != nil {
		return "", err
	}

	return nonce, nil

}

func (h *Hub) authenticateHandler(session *Session, st *SessionToken, userid string) error {

	err := session.Authenticate(h.realm, st, userid)
	if err == nil {
		// Authentication success.
		h.mutex.Lock()
		user, ok := h.userTable[session.Userid]
		if !ok {
			user = NewUser(session.Userid)
			h.userTable[session.Userid] = user
		}
		h.mutex.Unlock()
		user.AddSession(session)
	}

	return err

}

func (h *Hub) contactrequestHandler(c *Connection, to string, cr *DataContactRequest) error {

	var err error

	if cr.Success {
		// Client replied with success.
		// Decode Token and make sure c.Session.Userid and the to Session.UserId are a match.
		contact := &Contact{}
		err = h.contacts.Decode("contactRequest", cr.Token, contact)
		if err != nil {
			return err
		}
		if contact.Ok {
			return errors.New("received success with ok state set")
		}
		bSessionData := c.Session.Data()
		if bSessionData.Userid == "" {
			return errors.New("no userid")
		}
		h.mutex.RLock()
		aSession, ok := h.sessionTable[to]
		h.mutex.RUnlock()
		if !ok {
			return errors.New("unknown to session for confirm")
		}
		aSessionData := aSession.Data()
		if aSessionData.Userid == "" {
			return errors.New("to has no userid for confirm")
		}
		if aSessionData.Userid != contact.A {
			return errors.New("contact mismatch in a")
		}
		if bSessionData.Userid != contact.B {
			return errors.New("contact mismatch in b")
		}
		contact.Ok = true
		cr.Token, err = h.contacts.Encode("contactConfirmed", contact)
	} else {
		if cr.Token != "" {
			// Client replied with no success.
			// Decode Token.
			contact := &Contact{}
			err = h.contacts.Decode("contactRequest", cr.Token, contact)
			if err != nil {
				return err
			}
			// Remove token.
			cr.Token = ""
		} else {
			// New request.
			// Create Token with flag and c.Session.Userid and the to Session.Userid.
			aSessionData := c.Session.Data()
			if aSessionData.Userid == "" {
				return errors.New("no userid")
			}
			h.mutex.RLock()
			bSession, ok := h.sessionTable[to]
			h.mutex.RUnlock()
			if !ok {
				return errors.New("unknown to session")
			}
			bSessionData := bSession.Data()
			if bSessionData.Userid == "" {
				return errors.New("to has no userid")
			}
			if bSessionData.Userid == aSessionData.Userid {
				return errors.New("to userid cannot be the same as own userid")
			}
			// Create object.
			contact := &Contact{aSessionData.Userid, bSessionData.Userid, false}
			// Serialize.
			cr.Token, err = h.contacts.Encode("contactRequest", contact)
		}
	}

	return err

}
