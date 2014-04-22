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
	"sync"
)

type Session struct {
	Id        string
	Sid       string
	Userid    string
	Roomid    string
	Ua        string
	UpdateRev uint64
	Status    interface{}
	mutex     sync.RWMutex
}

func NewSession(id, sid, userid string) *Session {

	return &Session{
		Id:     id,
		Sid:    sid,
		Userid: userid,
	}

}

func (s *Session) Update(update *SessionUpdate) uint64 {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	for _, key := range update.Types {

		//fmt.Println("type update", key)
		switch key {
		case "Roomid":
			s.Roomid = update.Roomid
		case "Ua":
			s.Ua = update.Ua
		case "Status":
			s.Status = update.Status
		}

	}

	s.UpdateRev++
	return s.UpdateRev

}

func (s *Session) Apply(st *SessionToken) {

	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.Id = st.Id
	s.Userid = st.Userid

}

func (s *Session) Token() *SessionToken {
	return &SessionToken{Id: s.Id, Sid: s.Sid, Userid: s.Userid}
}

func (s *Session) Data() *DataSession {

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return &DataSession{
		Id:     s.Id,
		Userid: s.Userid,
		Ua:     s.Ua,
		Status: s.Status,
		Rev:    s.UpdateRev,
	}

}

type SessionUpdate struct {
	Id     string
	Types  []string
	Roomid string
	Ua     string
	Status interface{}
}

type SessionToken struct {
	Id     string
	Sid    string
	Userid string
}
