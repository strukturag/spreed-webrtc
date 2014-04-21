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
	"github.com/gorilla/websocket"
	"log"
	"net/http"
)

const (
	wsReadBufSize  = 1024
	wsWriteBufSize = 1024
)

func makeWsHubHandler(h *Hub) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {

		// Validate incoming request.
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Upgrade to Websocket mode.
		ws, err := websocket.Upgrade(w, r, nil, wsReadBufSize, wsWriteBufSize)
		if _, ok := err.(websocket.HandshakeError); ok {
			w.WriteHeader(http.StatusBadRequest)
			return
		} else if err != nil {
			log.Println(err)
			return
		}

		// Read request details.
		r.ParseForm()
		token := r.FormValue("t")
		remoteAddr := r.RemoteAddr
		if remoteAddr == "@" || remoteAddr == "127.0.0.1" {
			if r.Header["X-Forwarded-For"][0] != "" {
				remoteAddr = r.Header["X-Forwarded-For"][0]
			}
		}

		// Create a new connection instance.
		c := NewConnection(h, ws, remoteAddr)
		if token != "" {
			if err := c.reregister(token); err != nil {
				log.Println(err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		} else {
			if err := c.register(); err != nil {
				log.Println(err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		}

		// Start pumps (readPump blocks).
		go c.writePump()
		c.readPump()

	}

}
