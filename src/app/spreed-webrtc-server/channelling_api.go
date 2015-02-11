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
	"log"
	"time"
)

const (
	maxConferenceSize = 100
)

type ChannellingAPI interface {
	OnConnect(Client, *Session)
	OnDisconnect(Client, *Session)
	OnIncoming(ResponseSender, *Session, *DataIncoming)
}

type channellingAPI struct {
	*Config
	RoomStatusManager
	SessionEncoder
	SessionManager
	StatsCounter
	ContactManager
	TurnDataCreator
	Unicaster
}

func NewChannellingAPI(config *Config, roomStatus RoomStatusManager, sessionEncoder SessionEncoder, sessionManager SessionManager, statsCounter StatsCounter, contactManager ContactManager, turnDataCreator TurnDataCreator, unicaster Unicaster) ChannellingAPI {
	return &channellingAPI{
		config,
		roomStatus,
		sessionEncoder,
		sessionManager,
		statsCounter,
		contactManager,
		turnDataCreator,
		unicaster,
	}
}

func (api *channellingAPI) OnConnect(client Client, session *Session) {
	api.Unicaster.OnConnect(client, session)
	api.SendSelf(client, session)
}

func (api *channellingAPI) OnDisconnect(client Client, session *Session) {
	api.Unicaster.OnDisconnect(client, session)
}

func (api *channellingAPI) OnIncoming(c ResponseSender, session *Session, msg *DataIncoming) {
	switch msg.Type {
	case "Self":
		api.SendSelf(c, session)
	case "Hello":
		//log.Println("Hello", msg.Hello, c.Index())
		// TODO(longsleep): Filter room id and user agent.
		session.Update(&SessionUpdate{Types: []string{"Ua"}, Ua: msg.Hello.Ua})

		room, err := session.JoinRoom(msg.Hello.Id, msg.Hello.Credentials, c)
		// NOTE(lcooper): Iid filtered for compatibility's sake.
		// Evaluate sending unconditionally when supported by all clients.
		if msg.Iid != "" {
			if err == nil {
				c.Reply(msg.Iid, &DataWelcome{
					Type:  "Welcome",
					Room:  room,
					Users: api.RoomUsers(session),
				})
			} else {
				c.Reply(msg.Iid, err)
			}
		}
	case "Offer":
		// TODO(longsleep): Validate offer
		session.Unicast(msg.Offer.To, msg.Offer)
	case "Candidate":
		// TODO(longsleep): Validate candidate
		session.Unicast(msg.Candidate.To, msg.Candidate)
	case "Answer":
		// TODO(longsleep): Validate Answer
		session.Unicast(msg.Answer.To, msg.Answer)
	case "Users":
		if session.Hello {
			sessions := &DataSessions{Type: "Users", Users: api.RoomUsers(session)}
			c.Reply(msg.Iid, sessions)
		}
	case "Authentication":
		st := msg.Authentication.Authentication
		if st == nil {
			return
		}

		if err := api.Authenticate(session, st, ""); err == nil {
			log.Println("Authentication success", session.Userid)
			api.SendSelf(c, session)
			session.BroadcastStatus()
		} else {
			log.Println("Authentication failed", err, st.Userid, st.Nonce)
		}
	case "Bye":
		session.Unicast(msg.Bye.To, msg.Bye)
	case "Status":
		//log.Println("Status", msg.Status)
		session.Update(&SessionUpdate{Types: []string{"Status"}, Status: msg.Status.Status})
		session.BroadcastStatus()
	case "Chat":
		// TODO(longsleep): Limit sent chat messages per incoming connection.
		if !msg.Chat.Chat.NoEcho {
			session.Unicast(session.Id, msg.Chat)
		}
		msg.Chat.Chat.Time = time.Now().Format(time.RFC3339)
		if msg.Chat.To == "" {
			// TODO(longsleep): Check if chat broadcast is allowed.
			if session.Hello {
				api.CountBroadcastChat()
				session.Broadcast(msg.Chat)
			}
		} else {
			if msg.Chat.Chat.Status != nil && msg.Chat.Chat.Status.ContactRequest != nil {
				if err := api.contactrequestHandler(session, msg.Chat.To, msg.Chat.Chat.Status.ContactRequest); err != nil {
					log.Println("Ignoring invalid contact request.", err)
					return
				}
				msg.Chat.Chat.Status.ContactRequest.Userid = session.Userid()
			}
			if msg.Chat.Chat.Status == nil {
				api.CountUnicastChat()
			}

			session.Unicast(msg.Chat.To, msg.Chat)
			if msg.Chat.Chat.Mid != "" {
				// Send out delivery confirmation status chat message.
				session.Unicast(session.Id, &DataChat{To: msg.Chat.To, Type: "Chat", Chat: &DataChatMessage{Mid: msg.Chat.Chat.Mid, Status: &DataChatStatus{State: "sent"}}})
			}
		}
	case "Conference":
		// Check conference maximum size.
		if len(msg.Conference.Conference) > maxConferenceSize {
			log.Println("Refusing to create conference above limit.", len(msg.Conference.Conference))
		} else {
			// Send conference update to anyone.
			for _, id := range msg.Conference.Conference {
				if id != session.Id {
					session.Unicast(id, msg.Conference)
				}
			}
		}
	case "Alive":
		c.Reply(msg.Iid, msg.Alive)
	case "Sessions":
		var users []*DataSession
		switch msg.Sessions.Sessions.Type {
		case "contact":
			if userID, err := api.getContactID(session, msg.Sessions.Sessions.Token); err == nil {
				users = api.GetUserSessions(session, userID)
			} else {
				log.Printf(err.Error())
			}
		case "session":
			id, err := session.attestation.Decode(msg.Sessions.Sessions.Token)
			if err != nil {
				log.Printf("Failed to decode incoming attestation", err, msg.Sessions.Sessions.Token)
				break
			}
			session, ok := api.GetSession(id)
			if !ok {
				log.Printf("Cannot retrieve session for id %s", id)
				break
			}
			users = make([]*DataSession, 1, 1)
			users[0] = session.Data()
		default:
			log.Printf("Unkown incoming sessions request type %s", msg.Sessions.Sessions.Type)
		}

		// TODO(lcooper): We ought to reply with a *DataError here if failed.
		if users != nil {
			c.Reply(msg.Iid, &DataSessions{Type: "Sessions", Users: users, Sessions: msg.Sessions.Sessions})
		}
	case "Room":
		if room, err := api.UpdateRoom(session, msg.Room); err == nil {
			session.Broadcast(room)
			c.Reply(msg.Iid, room)
		} else {
			c.Reply(msg.Iid, err)
		}
	default:
		log.Println("OnText unhandled message type", msg.Type)
	}
}

func (api *channellingAPI) SendSelf(c Responder, session *Session) {
	token, err := api.EncodeSessionToken(session)
	if err != nil {
		log.Println("Error in OnRegister", err)
		return
	}

	log.Println("Created new session token", len(token), token)
	self := &DataSelf{
		Type:    "Self",
		Id:      session.Id,
		Sid:     session.Sid,
		Userid:  session.Userid(),
		Suserid: api.EncodeSessionUserID(session),
		Token:   token,
		Version: api.Version,
		Turn:    api.CreateTurnData(session),
		Stun:    api.StunURIs,
	}
	c.Reply("", self)
}
