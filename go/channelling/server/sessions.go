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

package server

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/strukturag/spreed-webrtc/go/channelling"

	"github.com/gorilla/mux"
)

type SessionNonce struct {
	Nonce   string `json:"nonce"`
	Userid  string `json:"userid"`
	Success bool   `json:"success"`
}

type SessionNonceRequest struct {
	Id          string `json:"id"`          // Public session id.
	Sid         string `json:"sid"`         // Private session id.
	UseridCombo string `json:"useridcombo"` // Public user id as used secret (Expiration:Userid)
	Secret      string `json:"secret"`      // base64(hmac-sha265(SecretKey, UseridCombo))
}

type Sessions struct {
	channelling.SessionValidator
	channelling.SessionStore
	Users *Users
}

// Patch is used to add a userid to a given session (login).
func (sessions *Sessions) Patch(request *http.Request) (int, interface{}, http.Header) {

	// Make sure to always run all the checks to make timing attacks harder.
	error := false

	decoder := json.NewDecoder(request.Body)
	var snr SessionNonceRequest
	err := decoder.Decode(&snr)
	if err != nil {
		error = true
	}

	vars := mux.Vars(request)
	id, ok := vars["id"]
	if !ok {
		error = true
	}

	// Make sure data matches request.
	if id != snr.Id {
		error = true
		log.Println("Session patch failed - request id mismatch.")
	}

	// Make sure that we have a Sid.
	if snr.Sid == "" {
		error = true
		log.Println("Session patch failed - sid empty.")
	}

	// Make sure Sid matches session and is valid.
	if !sessions.ValidateSession(snr.Id, snr.Sid) {
		log.Println("Session patch failed - validation failed.")
		error = true
	}

	var userid string
	// Validate with users handler.
	if sessions.Users.handler != nil {
		userid, err = sessions.Users.handler.Validate(&snr, request)
		if err != nil {
			error = true
			log.Println("Session patch failed - users validation failed.", err)
		}
		// Make sure that we have a user.
		if userid == "" {
			error = true
			log.Println("Session patch failed - userid empty.")
		}
	} else {
		log.Println("Session patch failed - no handler.")
		error = true
	}

	var nonce string
	if !error {
		// FIXME(longsleep): Not running this might reveal error state with a timing attack.
		if session, ok := sessions.GetSession(snr.Id); ok {
			nonce, err = session.Authorize(sessions.Realm(), &channelling.SessionToken{Id: snr.Id, Sid: snr.Sid, Userid: userid})
		} else {
			err = errors.New("no such session")
		}

		if err != nil {
			log.Println("Session patch failed - handle failed.", err)
			error = true
		}
	}

	if error {
		return 403, NewApiError("session_patch_failed", "Failed to patch session"), http.Header{"Content-Type": {"application/json"}}
	}

	log.Printf("Session patch successfull %s -> %s\n", snr.Id, userid)
	return 200, &SessionNonce{Nonce: nonce, Userid: userid, Success: true}, http.Header{"Content-Type": {"application/json"}}

}
