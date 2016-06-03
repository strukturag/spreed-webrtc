/*
 * Spreed WebRTC.
 * Copyright (C) 2016 struktur AG
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

package channelling

import (
	"crypto/rand"
	"encoding/base64"
	"testing"
)

func getRandom(n int) ([]byte, error) {
	result := make([]byte, n)
	if _, err := rand.Read(result); err != nil {
		return nil, err
	}
	return result, nil
}

func Test_ReverseBase64(t *testing.T) {
	for i := 0; i < 1000; i++ {
		data, err := getRandom(64)
		if err != nil {
			t.Errorf("Could not get random data: %v", err)
			continue
		}

		s := base64.URLEncoding.EncodeToString(data)
		reversed, err := reverseBase64String(s)
		if err != nil {
			t.Errorf("Could not reverse %s: %v", s, err)
			continue
		}

		if s == reversed {
			t.Errorf("Reversing should be different for %s", s)
		}

		original, err := reverseBase64String(reversed)
		if err != nil {
			t.Errorf("Could not reverse back %s: %v", reversed, err)
			continue
		}

		if s != original {
			t.Errorf("Reversing back should have restored %s from %s but got %s", s, reversed, original)
		}
	}
}

func Test_Sessions(t *testing.T) {
	sessionSecret, err := getRandom(64)
	if err != nil {
		t.Fatalf("Could not create session secret: %v", err)
		return
	}

	encryptionSecret, err := getRandom(32)
	if err != nil {
		t.Fatalf("Could not create encryption secret: %v", err)
		return
	}

	tickets := NewTickets(sessionSecret, encryptionSecret, "test")
	silentOutput = true
	for i := 0; i < 1000; i++ {
		st := tickets.DecodeSessionToken("")
		if st == nil {
			t.Error("Could not create session")
			continue
		}

		if !tickets.ValidateSession(st.Id, st.Sid) {
			t.Errorf("Session is invalid: %v", st)
			continue
		}
	}
	silentOutput = false
}
