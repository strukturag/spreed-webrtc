/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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
	"encoding/json"
	"github.com/gorilla/mux"
	"net/http"
)

type SessionNonce struct {
	Nonce   string `json:"nonce"`
	Success bool   `json:"success"`
}

type Sessions struct {
	hub *Hub
}

// Patch is used to add a userid to a given session (login).
func (sessions *Sessions) Patch(request *http.Request) (int, interface{}, http.Header) {

	// Make sure to always run all the checks to make timing attacks harder.
	error := false

	decoder := json.NewDecoder(request.Body)
	var st SessionToken
	err := decoder.Decode(&st)
	if err != nil {
		error = true
	}

	vars := mux.Vars(request)
	id, ok := vars["id"]
	if !ok {
		error = true
	}

	// Make sure data matches request.
	if id != st.Id {
		error = true
	}

	// Make sure that we have a Sid.
	if st.Sid == "" {
		error = true
	}

	// Make sure that we have a user.
	if st.Userid == "" {
		error = true
	}

	// TODO(longsleep): Validate userid.

	// Make sure Sid matches session.
	if !sessions.hub.ValidateSession(st.Id, st.Sid) {
		error = true
	}

	var nonce string
	if !error {
		// FIXME(longsleep): Not running this might releal error state with a timing attack.
		nonce, err = sessions.hub.sessiontokenHandler(&st)
		if err != nil {
			error = true
		}
	}

	if error {
		return 403, NewApiError("session_patch_failed", "Failed to patch session"), nil
	}

	return 200, &SessionNonce{Nonce: nonce, Success: true}, http.Header{"Content-Type": {"application/json"}}

}
