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
	"log"
	"net/http"
	"strings"

	"github.com/strukturag/spreed-webrtc/go/channelling"
)

type Token struct {
	Token   string `json:"token"`
	Success bool   `json:"success"`
}

type Tokens struct {
	Provider channelling.TokenProvider
}

func (tokens Tokens) Post(request *http.Request) (int, interface{}, http.Header) {

	auth := request.Form.Get("a")

	if len(auth) > 100 {
		return 413, NewApiError("auth_too_large", "Auth too large"), http.Header{"Content-Type": {"application/json"}}
	}

	valid := tokens.Provider(strings.ToLower(auth))

	if valid != "" {
		log.Printf("Good incoming token request: %s\n", auth)
		return 200, &Token{Token: valid, Success: true}, http.Header{"Content-Type": {"application/json"}}
	}
	log.Printf("Wrong incoming token request: %s\n", auth)
	return 403, NewApiError("invalid_token", "Invalid token"), http.Header{"Content-Type": {"application/json"}}

}
