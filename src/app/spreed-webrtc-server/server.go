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
	"encoding/json"
	"log"
	"sync/atomic"
	"time"
)

const (
	maxConferenceSize = 100
)

type Server struct {
}

func (s *Server) OnRegister(c *Connection) {
	//log.Println("OnRegister", c.id)
	if token, err := c.h.EncodeSessionToken(c.Session.Token()); err == nil {
		log.Println("Created new session token", len(token), token)
		// Send stuff back.
		s.Unicast(c, c.Id, &DataSelf{
			Type:    "Self",
			Id:      c.Id,
			Sid:     c.Session.Sid,
			Userid:  c.Session.Userid(),
			Suserid: c.h.CreateSuserid(c.Session),
			Token:   token,
			Version: c.h.version,
			Turn:    c.h.CreateTurnData(c.Id),
			Stun:    c.h.config.StunURIs,
		})
	} else {
		log.Println("Error in OnRegister", c.Idx, err)
	}
}

func (s *Server) OnUnregister(c *Connection) {
	//log.Println("OnUnregister", c.id)
	dsl := c.Session.DataSessionLeft("hard")
	if c.Hello {
		s.UpdateRoomConnection(c, &RoomConnectionUpdate{Id: c.Roomid})
		s.Broadcast(c, dsl)
	}
	c.Session.RunForAllSubscribers(func(session *Session) {
		log.Println("Notifying subscriber that we are gone", c.Id, session.Id)
		s.Unicast(c, session.Id, dsl)
	})
}

func (s *Server) OnText(c *Connection, b Buffer) {

	//log.Printf("OnText from %d: %s\n", c.Id, b)
	var msg DataIncoming
	err := json.Unmarshal(b.Bytes(), &msg)
	if err != nil {
		log.Println("OnText error while decoding JSON", err)
		log.Printf("JSON:\n%s\n", b)
		return
	}

	switch msg.Type {
	case "Self":
		s.OnRegister(c)
	case "Hello":
		//log.Println("Hello", msg.Hello, c.Idx)
		// TODO(longsleep): Filter room id and user agent.
		s.UpdateSession(c, &SessionUpdate{Types: []string{"Roomid", "Ua"}, Roomid: msg.Hello.Id, Ua: msg.Hello.Ua})
		if c.Hello && c.Roomid != msg.Hello.Id {
			// Room changed.
			s.UpdateRoomConnection(c, &RoomConnectionUpdate{Id: c.Roomid})
			s.Broadcast(c, c.Session.DataSessionLeft("soft"))
		}
		c.Roomid = msg.Hello.Id
		if c.h.config.DefaultRoomEnabled || !c.h.isDefaultRoomid(c.Roomid) {
			c.Hello = true
			s.UpdateRoomConnection(c, &RoomConnectionUpdate{Id: c.Roomid, Status: true})
			s.Broadcast(c, c.Session.DataSessionJoined())
		} else {
			c.Hello = false
		}
	case "Offer":
		// TODO(longsleep): Validate offer
		s.Unicast(c, msg.Offer.To, msg.Offer)
	case "Candidate":
		// TODO(longsleep): Validate candidate
		s.Unicast(c, msg.Candidate.To, msg.Candidate)
	case "Answer":
		// TODO(longsleep): Validate Answer
		s.Unicast(c, msg.Answer.To, msg.Answer)
	case "Users":
		if c.Hello {
			s.Users(c)
		}
	case "Authentication":
		if msg.Authentication.Authentication != nil && s.Authenticate(c, msg.Authentication.Authentication) {
			s.OnRegister(c)
			if c.Hello {
				s.Broadcast(c, c.Session.DataSessionStatus())
			}
		}
	case "Bye":
		s.Unicast(c, msg.Bye.To, msg.Bye)
	case "Status":
		//log.Println("Status", msg.Status)
		s.UpdateSession(c, &SessionUpdate{Types: []string{"Status"}, Status: msg.Status.Status})
		if c.Hello {
			s.Broadcast(c, c.Session.DataSessionStatus())
		}
	case "Chat":
		// TODO(longsleep): Limit sent chat messages per incoming connection.
		if !msg.Chat.Chat.NoEcho {
			s.Unicast(c, c.Id, msg.Chat)
		}
		msg.Chat.Chat.Time = time.Now().Format(time.RFC3339)
		if msg.Chat.To == "" {
			// TODO(longsleep): Check if chat broadcast is allowed.
			if c.Hello {
				atomic.AddUint64(&c.h.broadcastChatMessages, 1)
				s.Broadcast(c, msg.Chat)
			}
		} else {
			if msg.Chat.Chat.Status != nil && msg.Chat.Chat.Status.ContactRequest != nil {
				err = s.ContactRequest(c, msg.Chat.To, msg.Chat.Chat.Status.ContactRequest)
				if err != nil {
					log.Println("Ignoring invalid contact request.", err)
					return
				}
				msg.Chat.Chat.Status.ContactRequest.Userid = c.Session.Userid()
			}
			atomic.AddUint64(&c.h.unicastChatMessages, 1)
			s.Unicast(c, msg.Chat.To, msg.Chat)
			if msg.Chat.Chat.Mid != "" {
				// Send out delivery confirmation status chat message.
				s.Unicast(c, c.Id, &DataChat{To: msg.Chat.To, Type: "Chat", Chat: &DataChatMessage{Mid: msg.Chat.Chat.Mid, Status: &DataChatStatus{State: "sent"}}})
			}
		}
	case "Conference":
		// Check conference maximum size.
		if len(msg.Conference.Conference) > maxConferenceSize {
			log.Println("Refusing to create conference above limit.", len(msg.Conference.Conference))
		} else {
			// Send conference update to anyone.
			for _, id := range msg.Conference.Conference {
				if id != c.Id {
					//log.Println("participant", id)
					s.Unicast(c, id, msg.Conference)
				}
			}
		}
	case "Alive":
		s.Alive(c, msg.Alive, msg.Iid)
	case "Sessions":
		s.Sessions(c, msg.Sessions.Sessions, msg.Iid)
	default:
		log.Println("OnText unhandled message type", msg.Type)
	}

}

func (s *Server) Unicast(c *Connection, to string, m interface{}) {

	outgoing := &DataOutgoing{From: c.Id, To: to, Data: m}
	if !c.isClosing && c.Id != to {
		outgoing.A = c.Session.Attestation()
	}
	b := c.h.buffers.New()
	encoder := json.NewEncoder(b)
	err := encoder.Encode(outgoing)
	if err != nil {
		b.Decref()
		log.Println("Unicast error while encoding JSON", err)
		return
	}
	//log.Println("Unicast", b)

	var msg = &MessageRequest{From: c.Id, To: to, Message: b}
	c.h.unicastHandler(msg)
	b.Decref()
}

func (s *Server) Broadcast(c *Connection, m interface{}) {

	b := c.h.buffers.New()
	encoder := json.NewEncoder(b)
	err := encoder.Encode(&DataOutgoing{From: c.Id, Data: m, A: c.Session.Attestation()})
	if err != nil {
		b.Decref()
		log.Println("Broadcast error while encoding JSON", err)
		return
	}

	if c.h.isGlobalRoomid(c.Roomid) {
		c.h.RunForAllRooms(func(room *RoomWorker) {
			var msg = &MessageRequest{From: c.Id, Message: b, Id: room.Id}
			room.broadcastHandler(msg)
		})
	} else {
		var msg = &MessageRequest{From: c.Id, Message: b, Id: c.Roomid}
		room := c.h.GetRoom(c.Roomid)
		room.broadcastHandler(msg)
	}
	b.Decref()

}

func (s *Server) Alive(c *Connection, alive *DataAlive, iid string) {

	c.h.aliveHandler(c, alive, iid)

}

func (s *Server) Sessions(c *Connection, srq *DataSessionsRequest, iid string) {

	c.h.sessionsHandler(c, srq, iid)

}

func (s *Server) UpdateSession(c *Connection, su *SessionUpdate) uint64 {

	su.Id = c.Id
	return c.h.sessionupdateHandler(su)

}

func (s *Server) ContactRequest(c *Connection, to string, cr *DataContactRequest) (err error) {

	return c.h.contactrequestHandler(c, to, cr)

}

func (s *Server) Users(c *Connection) {

	room := c.h.GetRoom(c.Roomid)
	room.usersHandler(c)

}

func (s *Server) Authenticate(c *Connection, st *SessionToken) bool {

	err := c.h.authenticateHandler(c.Session, st, "")
	if err == nil {
		log.Println("Authentication success", c.Id, c.Idx, c.Session.Userid)
		return true
	} else {
		log.Println("Authentication failed", err, c.Id, c.Idx, st.Userid, st.Nonce)
		return false
	}

}

func (s *Server) UpdateRoomConnection(c *Connection, rcu *RoomConnectionUpdate) {

	rcu.Sessionid = c.Id
	rcu.Connection = c
	room := c.h.GetRoom(c.Roomid)
	room.connectionHandler(rcu)

}
