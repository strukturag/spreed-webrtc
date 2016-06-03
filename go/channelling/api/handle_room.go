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

func (api *channellingAPI) HandleRoom(session *channelling.Session, room *channelling.DataRoom) (*channelling.DataRoom, error) {
	room, err := api.RoomStatusManager.UpdateRoom(session, room)
	if err == nil {
		session.Broadcast(room)
	}

	return room, err
}

func (api *channellingAPI) RoomProcessed(sender channelling.Sender, session *channelling.Session, msg *channelling.DataIncoming, reply interface{}, err error) {
	if err == nil {
		api.SendConferenceRoomUpdate(session)
	}
}

func (api *channellingAPI) SendConferenceRoomUpdate(session *channelling.Session) {
	// If user joined a server-managed conference room, send list of session ids to all participants.
	if room, ok := api.RoomStatusManager.Get(session.Roomid); ok && room.GetType() == channelling.RoomTypeConference {
		if sessionids := room.SessionIDs(); len(sessionids) > 1 {
			cid := session.Roomid
			session.Broadcaster.Broadcast("", session.Roomid, &channelling.DataOutgoing{
				To: cid,
				Data: &channelling.DataConference{
					Type:       "Conference",
					Id:         cid,
					Conference: sessionids,
				},
			})
		}
	}
}
