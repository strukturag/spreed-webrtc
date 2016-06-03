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

func (api *channellingAPI) HandleSelf(session *channelling.Session) (*channelling.DataSelf, error) {
	token, err := api.SessionEncoder.EncodeSessionToken(session)
	if err != nil {
		log.Println("Error in OnRegister", err)
		return nil, err
	}

	log.Println("Created new session token", len(token), token)
	self := &channelling.DataSelf{
		Type:       "Self",
		Id:         session.Id,
		Sid:        session.Sid,
		Userid:     session.Userid(),
		Suserid:    api.SessionEncoder.EncodeSessionUserID(session),
		Token:      token,
		Version:    api.config.Version,
		ApiVersion: apiVersion,
		Turn:       api.TurnDataCreator.CreateTurnData(session),
		Stun:       api.config.StunURIs,
	}
	api.BusManager.Trigger(channelling.BusManagerSession, session.Id, session.Userid(), nil, nil)

	return self, nil
}
