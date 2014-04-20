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
	Roomid    string
	Ua        string
	UpdateRev uint64
	Status    interface{}
	mutex     sync.RWMutex
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

func (s *Session) Data() *DataSession {

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return &DataSession{
		Id:     s.Id,
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
