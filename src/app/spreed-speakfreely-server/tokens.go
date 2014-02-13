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
	"log"
	"net/http"
	"strings"
)

type Tokens struct {
	provider TokenProvider
}

func (tokens Tokens) Post(r *http.Request) (int, interface{}) {

	r.ParseForm()
	auth := r.FormValue("a")

	remoteAddr := r.RemoteAddr
	if remoteAddr == "@" || remoteAddr == "127.0.0.1" {
		if r.Header["X-Forwarded-For"][0] != "" {
			remoteAddr = r.Header["X-Forwarded-For"][0]
		}
	}

	if len(auth) > 100 {
		return 413, NewApiError("auth_too_large", "Auth too large")
	}

	valid := tokens.provider(strings.ToLower(auth))
	response := &Token{Token: valid}

	if valid != "" {
		log.Printf("Good incoming token request: %s from %s\n", auth, remoteAddr)
		response.Success = true
	} else {
		log.Printf("Wrong incoming token request: %s from %s\n", auth, remoteAddr)
	}

	return 200, response

}
