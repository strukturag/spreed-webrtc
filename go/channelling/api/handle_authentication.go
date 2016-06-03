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

func (api *channellingAPI) HandleAuthentication(session *channelling.Session, st *channelling.SessionToken) (*channelling.DataSelf, error) {
	if err := api.SessionManager.Authenticate(session, st, ""); err != nil {
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
