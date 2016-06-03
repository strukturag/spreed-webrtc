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
	"fmt"
	"net/http"

	"github.com/strukturag/spreed-webrtc/go/randomstring"
)

type Room struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

type Rooms struct {
}

func (rooms *Rooms) Post(request *http.Request) (int, interface{}, http.Header) {

	name := randomstring.NewRandomString(11)
	return 200, &Room{name, fmt.Sprintf("/%s", name)}, http.Header{"Content-Type": {"application/json"}}

}
