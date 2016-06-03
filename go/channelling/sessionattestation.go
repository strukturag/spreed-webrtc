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

package channelling

import (
	"time"
)

type SessionAttestation struct {
	refresh int64
	token   string
	s       *Session
}

func (sa *SessionAttestation) Update() (string, error) {
	token, err := sa.Encode()
	if err == nil {
		sa.token = token
		sa.refresh = time.Now().Unix() + 180 // expires after 3 minutes
	}
	return token, err
}

func (sa *SessionAttestation) Token() (token string) {
	if sa.refresh < time.Now().Unix() {
		token, _ = sa.Update()
	} else {
		token = sa.token
	}
	return
}

func (sa *SessionAttestation) Encode() (string, error) {
	return sa.s.attestations.Encode("attestation", sa.s.Id)
}

func (sa *SessionAttestation) Decode(token string) (string, error) {
	var id string
	err := sa.s.attestations.Decode("attestation", token, &id)
	return id, err
}
