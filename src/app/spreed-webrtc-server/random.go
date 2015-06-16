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
	"crypto/rand"
	pseudoRand "math/rand"
	"time"
)

const (
	dict = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVW0123456789"
)

func NewRandomString(length int) string {

	buf := make([]byte, length)
	_, err := rand.Read(buf)
	if err != nil {
		// fallback to pseudo-random
		for i := 0; i < length; i++ {
			buf[i] = dict[pseudoRand.Intn(len(dict))]
		}
	} else {
		for i := 0; i < length; i++ {
			buf[i] = dict[int(buf[i])%len(dict)]
		}
	}
	return string(buf)

}

func init() {
	// Make sure to seed default random generator.
	pseudoRand.Seed(time.Now().UTC().UnixNano())
}
