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

func (api *channellingAPI) HandleConference(session *channelling.Session, conference *channelling.DataConference) {
	if room, ok := api.RoomStatusManager.Get(session.Roomid); ok && room.GetType() == channelling.RoomTypeConference {
		log.Println("Refusing client-side conference update for server-managed conferences.")
		return
	}

	// Check conference maximum size.
	if len(conference.Conference) > maxConferenceSize {
		log.Println("Refusing to create conference above limit.", len(conference.Conference))
		return
	}

	// Send conference update to anyone.
	for _, id := range conference.Conference {
		if id != session.Id {
			session.Unicast(id, conference, nil)
		}
	}
}
