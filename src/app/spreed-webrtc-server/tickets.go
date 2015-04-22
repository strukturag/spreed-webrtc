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
	"crypto/aes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"log"

	"github.com/gorilla/securecookie"
)

type SessionValidator interface {
	Realm() string
	ValidateSession(string, string) bool
}

type SessionEncoder interface {
	EncodeSessionToken(*Session) (string, error)
	EncodeSessionUserID(*Session) string
}

type Tickets interface {
	SessionValidator
	SessionEncoder
	DecodeSessionToken(token string) (st *SessionToken)
	FakeSessionToken(userid string) *SessionToken
}

type tickets struct {
	*securecookie.SecureCookie
	realm            string
	tokenName        string
	encryptionSecret []byte
}

func NewTickets(sessionSecret, encryptionSecret []byte, realm string) Tickets {
	tickets := &tickets{
		nil,
		realm,
		fmt.Sprintf("token@%s", realm),
		encryptionSecret,
	}
	tickets.SecureCookie = securecookie.New(sessionSecret, encryptionSecret)
	tickets.MaxAge(86400 * 30) // 30 days
	tickets.HashFunc(sha256.New)
	tickets.BlockFunc(aes.NewCipher)

	return tickets
}

func (tickets *tickets) Realm() string {
	return tickets.realm
}

func (tickets *tickets) DecodeSessionToken(token string) (st *SessionToken) {
	var err error
	if token != "" {
		st = &SessionToken{}
		err = tickets.Decode(tickets.tokenName, token, st)
		if err != nil {
			log.Println("Error while decoding session token", err)
		}
	}

	if st == nil || err != nil {
		sid := NewRandomString(32)
		id, _ := tickets.Encode("id", sid)
		st = &SessionToken{Id: id, Sid: sid}
		log.Println("Created new session id", id)
	}
	return
}

func (tickets *tickets) FakeSessionToken(userid string) *SessionToken {
	st := &SessionToken{}
	st.Sid = fmt.Sprintf("fake-%s", NewRandomString(27))
	st.Id, _ = tickets.Encode("id", st.Sid)
	st.Userid = userid
	log.Println("Created new fake session id", st.Id)
	return st
}

func (tickets *tickets) ValidateSession(id, sid string) bool {
	var decoded string
	if err := tickets.Decode("id", id, &decoded); err != nil {
		log.Println("Session validation error", err, id, sid)
		return false
	}
	if decoded != sid {
		log.Println("Session validation failed", id, sid)
		return false
	}
	return true
}

func (tickets *tickets) EncodeSessionToken(session *Session) (string, error) {
	return tickets.Encode(tickets.tokenName, session.Token())
}

func (tickets *tickets) EncodeSessionUserID(session *Session) (suserid string) {
	if userid := session.Userid(); userid != "" {
		m := hmac.New(sha256.New, tickets.encryptionSecret)
		m.Write([]byte(userid))
		suserid = base64.StdEncoding.EncodeToString(m.Sum(nil))
	}
	return
}
