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

package randomstring

import (
	"crypto/rand"
	"math/big"
	pseudoRand "math/rand"
	"time"
)

const (
	dict = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

func newRandomInt(max *big.Int) int {
	rand, err := rand.Int(rand.Reader, max)
	if err != nil {
		// Fallback to pseudo-random
		return pseudoRand.Intn(int(max.Int64()))
	}
	return int(rand.Int64())
}

// NewRandomString returns a alphanumeric random string with
// the specified length using crypto/rand with fallback to
// math/rand on error.
func NewRandomString(length int) string {
	buf := make([]byte, length)
	max := big.NewInt(int64(len(dict)))
	for i := 0; i < length; i++ {
		buf[i] = dict[newRandomInt(max)]
	}
	return string(buf)
}

func init() {
	// Make sure to seed default random generator.
	pseudoRand.Seed(time.Now().UTC().UnixNano())
}
