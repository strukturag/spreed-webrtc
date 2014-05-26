/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
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

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  wsReadBufSize,
		WriteBufferSize: wsWriteBufSize,
		CheckOrigin: func(r *http.Request) bool {
			// Allow all connections by default to keep backwards
			// compatibility, but we should really check the Origin
			// header instead!
			//
			// NOTE: We can omit "CheckOrigin" if the host in Origin
			//       must be the same as the host of the request (which
			//       is probably always the case).
			return true
		},
	}
)

func makeWsHubHandler(h *Hub) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {

		// Validate incoming request.
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Upgrade to Websocket mode.
		ws, err := upgrader.Upgrade(w, r, nil)
		if _, ok := err.(websocket.HandshakeError); ok {
			return
		} else if err != nil {
			log.Println(err)
			return
		}

		// Read request details.
		r.ParseForm()
		token := r.FormValue("t")

		// Create a new connection instance.
		c := NewConnection(h, ws, r)
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
