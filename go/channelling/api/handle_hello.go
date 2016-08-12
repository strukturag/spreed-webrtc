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
	"github.com/strukturag/spreed-webrtc/go/channelling"
)

func (api *channellingAPI) HandleHello(session *channelling.Session, hello *channelling.DataHello, sender channelling.Sender) (*channelling.DataWelcome, error) {
	// TODO(longsleep): Filter room id and user agent.
	session.Update(&channelling.SessionUpdate{Types: []string{"Ua"}, Ua: hello.Ua})

	// Compatibily for old clients.
	roomName := hello.Name
	if roomName == "" {
		roomName = hello.Id
	}

	room, err := session.JoinRoom(roomName, hello.Type, hello.Credentials, sender)
	if err != nil {
		return nil, err
	}

	return &channelling.DataWelcome{
		Type:  "Welcome",
		Room:  room,
		Users: api.RoomStatusManager.RoomUsers(session),
	}, nil
}

func (api *channellingAPI) HelloProcessed(sender channelling.Sender, session *channelling.Session, msg *channelling.DataIncoming, reply interface{}, err error) {
	if err == nil {
		api.SendConferenceRoomUpdate(session)
	}
}
