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
	"time"

	"github.com/strukturag/spreed-webrtc/go/channelling"
)

func (api *channellingAPI) HandleChat(session *channelling.Session, chat *channelling.DataChat) {
	// TODO(longsleep): Limit sent chat messages per incoming connection.
	msg := chat.Chat
	to := chat.To

	if !msg.NoEcho {
		session.Unicast(session.Id, chat, nil)
	}
	msg.Time = time.Now().Format(time.RFC3339)
	if to == "" {
		// TODO(longsleep): Check if chat broadcast is allowed.
		if session.Hello {
			api.StatsCounter.CountBroadcastChat()
			session.Broadcast(chat)
		}
	} else {
		if msg.Status != nil {
			if msg.Status.ContactRequest != nil {
				if !api.config.WithModule("contacts") {
					return
				}
				if err := api.ContactManager.ContactrequestHandler(session, to, msg.Status.ContactRequest); err != nil {
					log.Println("Ignoring invalid contact request.", err)
					return
				}
				msg.Status.ContactRequest.Userid = session.Userid()
			}
		} else {
			api.StatsCounter.CountUnicastChat()
		}

		session.Unicast(to, chat, nil)
		if msg.Mid != "" {
			// Send out delivery confirmation status chat message.
			session.Unicast(session.Id, &channelling.DataChat{To: to, Type: "Chat", Chat: &channelling.DataChatMessage{Mid: msg.Mid, Status: &channelling.DataChatStatus{State: "sent"}}}, nil)
		}
	}
}
