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

func (api *channellingAPI) HandleSessions(session *channelling.Session, sessions *channelling.DataSessionsRequest) (*channelling.DataSessions, error) {
	switch sessions.Type {
	case "contact":
		if !api.config.WithModule("contacts") {
			return nil, channelling.NewDataError("contacts_not_enabled", "incoming contacts session request with contacts disabled")
		}
		userID, err := api.ContactManager.GetContactID(session, sessions.Token)
		if err != nil {
			return nil, err
		}
		return &channelling.DataSessions{
			Type:     "Sessions",
			Users:    api.SessionManager.GetUserSessions(session, userID),
			Sessions: sessions,
		}, nil
	case "session":
		id, err := session.DecodeAttestation(sessions.Token)
		if err != nil {
			return nil, channelling.NewDataError("bad_attestation", err.Error())
		}
		session, ok := api.Unicaster.GetSession(id)
		if !ok {
			return nil, channelling.NewDataError("no_such_session", "cannot retrieve session")
		}
		return &channelling.DataSessions{
			Type:     "Sessions",
			Users:    []*channelling.DataSession{session.Data()},
			Sessions: sessions,
		}, nil
	default:
		return nil, channelling.NewDataError("bad_request", "unknown sessions request type")
	}
}
