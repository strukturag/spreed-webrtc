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

package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/strukturag/spreed-webrtc/go/channelling"

	"github.com/gorilla/mux"
)

func makeImageHandler(buddyImages channelling.ImageCache, expires time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		image := buddyImages.Get(vars["imageid"])
		if image == nil {
			http.Error(w, "Unknown image", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", image.MimeType())
		w.Header().Set("ETag", image.LastChangeID())
		age := time.Now().Sub(image.LastChange())
		if age >= time.Second {
			w.Header().Set("Age", strconv.Itoa(int(age.Seconds())))
		}
		if expires >= time.Second {
			w.Header().Set("Expires", time.Now().Add(expires).Format(time.RFC1123))
			w.Header().Set("Cache-Control", "public, no-transform, max-age="+strconv.Itoa(int(expires.Seconds())))
		}

		http.ServeContent(w, r, "", image.LastChange(), image.Reader())
	}
}
