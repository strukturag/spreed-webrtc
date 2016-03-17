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

package api

import (
	"log"

	"github.com/strukturag/spreed-webrtc/go/channelling"
)

const (
	maxConferenceSize = 100
	apiVersion        = 1.4 // Keep this in sync with CHANNELING-API docs.Hand
)

type channellingAPI struct {
	RoomStatusManager channelling.RoomStatusManager
	SessionEncoder    channelling.SessionEncoder
	SessionManager    channelling.SessionManager
	StatsCounter      channelling.StatsCounter
	ContactManager    channelling.ContactManager
	TurnDataCreator   channelling.TurnDataCreator
	Unicaster         channelling.Unicaster
	BusManager        channelling.BusManager
	config            *channelling.Config
}

// New creates and initializes a new ChannellingAPI using
// various other services for initialization. It is intended to handle
// incoming and outgoing channeling API events from clients.
func New(config *channelling.Config,
	roomStatus channelling.RoomStatusManager,
	sessionEncoder channelling.SessionEncoder,
	sessionManager channelling.SessionManager,
	statsCounter channelling.StatsCounter,
	contactManager channelling.ContactManager,
	turnDataCreator channelling.TurnDataCreator,
	unicaster channelling.Unicaster,
	busManager channelling.BusManager) channelling.ChannellingAPI {
	return &channellingAPI{
		roomStatus,
		sessionEncoder,
		sessionManager,
		statsCounter,
		contactManager,
		turnDataCreator,
		unicaster,
		busManager,
		config,
	}
}

func (api *channellingAPI) OnConnect(client *channelling.Client, session *channelling.Session) (interface{}, error) {
	api.Unicaster.OnConnect(client, session)
	self, err := api.HandleSelf(session)
	if err == nil {
		api.BusManager.Trigger(channelling.BusManagerConnect, session.Id, "", nil)
	}
	return self, err
}

func (api *channellingAPI) OnDisconnect(client *channelling.Client, session *channelling.Session) {
	api.Unicaster.OnDisconnect(client, session)
	api.BusManager.Trigger(channelling.BusManagerDisconnect, session.Id, "", nil)
}

func (api *channellingAPI) OnIncoming(sender channelling.Sender, session *channelling.Session, msg *channelling.DataIncoming) (interface{}, error) {
	switch msg.Type {
	case "Self":
		return api.HandleSelf(session)
	case "Hello":
		if msg.Hello == nil {
			return nil, channelling.NewDataError("bad_request", "message did not contain Hello")
		}

		return api.HandleHello(session, msg.Hello, sender)
	case "Offer":
		if msg.Offer == nil || msg.Offer.Offer == nil {
			log.Println("Received invalid offer message.", msg)
			break
		}
		if _, ok := msg.Offer.Offer["_token"]; !ok {
			// Trigger offer event when offer has no token, so this is
			// not triggered for peerxfer and peerscreenshare offers.
			api.BusManager.Trigger(channelling.BusManagerOffer, session.Id, msg.Offer.To, nil)
		}

		session.Unicast(msg.Offer.To, msg.Offer)
	case "Candidate":
		if msg.Candidate == nil || msg.Candidate.Candidate == nil {
			log.Println("Received invalid candidate message.", msg)
			break
		}

		session.Unicast(msg.Candidate.To, msg.Candidate)
	case "Answer":
		if msg.Answer == nil || msg.Answer.Answer == nil {
			log.Println("Received invalid answer message.", msg)
			break
		}
		if _, ok := msg.Answer.Answer["_token"]; !ok {
			// Trigger answer event when answer has no token. so this is
			// not triggered for peerxfer and peerscreenshare answers.
			api.BusManager.Trigger(channelling.BusManagerAnswer, session.Id, msg.Answer.To, nil)
		}

		session.Unicast(msg.Answer.To, msg.Answer)
	case "Users":
		return api.HandleUsers(session)
	case "Authentication":
		if msg.Authentication == nil || msg.Authentication.Authentication == nil {
			return nil, channelling.NewDataError("bad_request", "message did not contain Authentication")
		}

		return api.HandleAuthentication(session, msg.Authentication.Authentication)
	case "Bye":
		if msg.Bye == nil {
			log.Println("Received invalid bye message.", msg)
			break
		}
		api.BusManager.Trigger(channelling.BusManagerBye, session.Id, msg.Bye.To, nil)

		session.Unicast(msg.Bye.To, msg.Bye)
	case "Status":
		if msg.Status == nil {
			log.Println("Received invalid status message.", msg)
			break
		}

		//log.Println("Status", msg.Status)
		session.Update(&channelling.SessionUpdate{Types: []string{"Status"}, Status: msg.Status.Status})
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
			return nil, channelling.NewDataError("bad_request", "message did not contain Sessions")
		}

		return api.HandleSessions(session, msg.Sessions.Sessions)
	case "Room":
		if msg.Room == nil {
			return nil, channelling.NewDataError("bad_request", "message did not contain Room")
		}

		return api.HandleRoom(session, msg.Room)
	default:
		log.Println("OnText unhandled message type", msg.Type)
	}

	return nil, nil
}
