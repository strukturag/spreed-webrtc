/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2015 struktur AG
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
	apiVersion        = 1.4 // Keep this in sync with CHANNELING-API docs.Hand
)

type ChannellingAPI interface {
	OnConnect(Client, *Session) (interface{}, error)
	OnDisconnect(Client, *Session)
	OnIncoming(Sender, *Session, *DataIncoming) (interface{}, error)
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

func (api *channellingAPI) OnConnect(client Client, session *Session) (interface{}, error) {
	api.Unicaster.OnConnect(client, session)
	return api.HandleSelf(session)
}

func (api *channellingAPI) OnDisconnect(client Client, session *Session) {
	api.Unicaster.OnDisconnect(client, session)
}

func (api *channellingAPI) OnIncoming(sender Sender, session *Session, msg *DataIncoming) (interface{}, error) {
	switch msg.Type {
	case "Self":
		return api.HandleSelf(session)
	case "Hello":
		if msg.Hello == nil {
			return nil, NewDataError("bad_request", "message did not contain Hello")
		}

		return api.HandleHello(session, msg.Hello, sender)
	case "Offer":
		if msg.Offer == nil {
			log.Println("Received invalid offer message.", msg)
			break
		}

		// TODO(longsleep): Validate offer
		session.Unicast(msg.Offer.To, msg.Offer)
	case "Candidate":
		if msg.Candidate == nil {
			log.Println("Received invalid candidate message.", msg)
			break
		}

		// TODO(longsleep): Validate candidate
		session.Unicast(msg.Candidate.To, msg.Candidate)
	case "Answer":
		if msg.Answer == nil {
			log.Println("Received invalid answer message.", msg)
			break
		}

		// TODO(longsleep): Validate Answer
		session.Unicast(msg.Answer.To, msg.Answer)
	case "Users":
		return api.HandleUsers(session)
	case "Authentication":
		if msg.Authentication == nil || msg.Authentication.Authentication == nil {
			return nil, NewDataError("bad_request", "message did not contain Authentication")
		}

		return api.HandleAuthentication(session, msg.Authentication.Authentication)
	case "Bye":
		if msg.Bye == nil {
			log.Println("Received invalid bye message.", msg)
			break
		}

		session.Unicast(msg.Bye.To, msg.Bye)
	case "Status":
		if msg.Status == nil {
			log.Println("Received invalid status message.", msg)
			break
		}

		//log.Println("Status", msg.Status)
		session.Update(&SessionUpdate{Types: []string{"Status"}, Status: msg.Status.Status})
		session.BroadcastStatus()
	case "Chat":
		if msg.Chat == nil || msg.Chat.Chat == nil {
			log.Println("Received invalid chat message.", msg)
			break
		}

		api.HandleChat(session, msg.Chat)
	case "Conference":
		if msg.Conference == nil {
			log.Println("Received invalid conference message.", msg)
			break
		}

		api.HandleConference(session, msg.Conference)
	case "Alive":
		return msg.Alive, nil
	case "Sessions":
		if msg.Sessions == nil || msg.Sessions.Sessions == nil {
			return nil, NewDataError("bad_request", "message did not contain Sessions")
		}

		return api.HandleSessions(session, msg.Sessions.Sessions)
	case "Room":
		if msg.Room == nil {
			return nil, NewDataError("bad_request", "message did not contain Room")
		}

		return api.HandleRoom(session, msg.Room)
	default:
		log.Println("OnText unhandled message type", msg.Type)
	}

	return nil, nil
}

func (api *channellingAPI) HandleSelf(session *Session) (*DataSelf, error) {
	token, err := api.EncodeSessionToken(session)
	if err != nil {
		log.Println("Error in OnRegister", err)
		return nil, err
	}

	log.Println("Created new session token", len(token), token)
	self := &DataSelf{
		Type:       "Self",
		Id:         session.Id,
		Sid:        session.Sid,
		Userid:     session.Userid(),
		Suserid:    api.EncodeSessionUserID(session),
		Token:      token,
		Version:    api.Version,
		ApiVersion: apiVersion,
		Turn:       api.CreateTurnData(session),
		Stun:       api.StunURIs,
	}

	return self, nil
}

func (api *channellingAPI) HandleHello(session *Session, hello *DataHello, sender Sender) (*DataWelcome, error) {
	// TODO(longsleep): Filter room id and user agent.
	session.Update(&SessionUpdate{Types: []string{"Ua"}, Ua: hello.Ua})

	// Compatibily for old clients.
	roomName := hello.Name
	if roomName == "" {
		roomName = hello.Id
	}

	room, err := session.JoinRoom(roomName, hello.Type, hello.Credentials, sender)
	if err != nil {
		return nil, err
	}
	return &DataWelcome{
		Type:  "Welcome",
		Room:  room,
		Users: api.RoomUsers(session),
	}, nil
}

func (api *channellingAPI) HandleUsers(session *Session) (sessions *DataSessions, err error) {
	if session.Hello {
		sessions = &DataSessions{Type: "Users", Users: api.RoomUsers(session)}
	} else {
		err = NewDataError("not_in_room", "Cannot list users without a current room")
	}
	return
}

func (api *channellingAPI) HandleAuthentication(session *Session, st *SessionToken) (*DataSelf, error) {
	if err := api.Authenticate(session, st, ""); err != nil {
		log.Println("Authentication failed", err, st.Userid, st.Nonce)
		return nil, err
	}

	log.Println("Authentication success", session.Userid())
	self, err := api.HandleSelf(session)
	if err == nil {
		session.BroadcastStatus()
	}

	return self, err
}

func (api *channellingAPI) HandleChat(session *Session, chat *DataChat) {
	// TODO(longsleep): Limit sent chat messages per incoming connection.
	msg := chat.Chat
	to := chat.To

	if !msg.NoEcho {
		session.Unicast(session.Id, chat)
	}
	msg.Time = time.Now().Format(time.RFC3339)
	if to == "" {
		// TODO(longsleep): Check if chat broadcast is allowed.
		if session.Hello {
			api.CountBroadcastChat()
			session.Broadcast(chat)
		}
	} else {
		if msg.Status != nil {
			if msg.Status.ContactRequest != nil {
				if !api.Config.WithModule("contacts") {
					return
				}
				if err := api.contactrequestHandler(session, to, msg.Status.ContactRequest); err != nil {
					log.Println("Ignoring invalid contact request.", err)
					return
				}
				msg.Status.ContactRequest.Userid = session.Userid()
			}
		} else {
			api.CountUnicastChat()
		}

		session.Unicast(to, chat)
		if msg.Mid != "" {
			// Send out delivery confirmation status chat message.
			session.Unicast(session.Id, &DataChat{To: to, Type: "Chat", Chat: &DataChatMessage{Mid: msg.Mid, Status: &DataChatStatus{State: "sent"}}})
		}
	}
}

func (api *channellingAPI) HandleConference(session *Session, conference *DataConference) {
	// Check conference maximum size.
	if len(conference.Conference) > maxConferenceSize {
		log.Println("Refusing to create conference above limit.", len(conference.Conference))
		return
	}

	// Send conference update to anyone.
	for _, id := range conference.Conference {
		if id != session.Id {
			session.Unicast(id, conference)
		}
	}
}

func (api *channellingAPI) HandleSessions(session *Session, sessions *DataSessionsRequest) (*DataSessions, error) {
	switch sessions.Type {
	case "contact":
		if !api.Config.WithModule("contacts") {
			return nil, NewDataError("contacts_not_enabled", "incoming contacts session request with contacts disabled")
		}
		userID, err := api.getContactID(session, sessions.Token)
		if err != nil {
			return nil, err
		}
		return &DataSessions{
			Type:     "Sessions",
			Users:    api.GetUserSessions(session, userID),
			Sessions: sessions,
		}, nil
	case "session":
		id, err := session.attestation.Decode(sessions.Token)
		if err != nil {
			return nil, NewDataError("bad_attestation", err.Error())
		}
		session, ok := api.GetSession(id)
		if !ok {
			return nil, NewDataError("no_such_session", "cannot retrieve session")
		}
		return &DataSessions{
			Type:     "Sessions",
			Users:    []*DataSession{session.Data()},
			Sessions: sessions,
		}, nil
	default:
		return nil, NewDataError("bad_request", "unknown sessions request type")
	}
}

func (api *channellingAPI) HandleRoom(session *Session, room *DataRoom) (*DataRoom, error) {
	room, err := api.UpdateRoom(session, room)
	if err == nil {
		session.Broadcast(room)
	}
	return room, err
}
