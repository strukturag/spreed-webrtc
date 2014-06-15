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
	"fmt"
	"sync"
)

type User struct {
	Id           string
	sessionTable map[string]*Session
	mutex        sync.RWMutex
}

func NewUser(id string) *User {

	user := &User{
		Id:           id,
		sessionTable: make(map[string]*Session),
	}
	return user

}

// Return true if first session.
func (u *User) AddSession(s *Session) bool {
	first := false
	u.mutex.Lock()
	u.sessionTable[s.Id] = s
	if len(u.sessionTable) == 1 {
		fmt.Println("First session registered for user", u.Id)
		first = true
	}
	u.mutex.Unlock()
	return first
}

// Return true if no session left.
func (u *User) RemoveSession(s *Session) bool {
	last := false
	u.mutex.Lock()
	delete(u.sessionTable, s.Id)
	if len(u.sessionTable) == 0 {
		fmt.Println("Last session unregistered for user", u.Id)
		last = true
	}
	u.mutex.Unlock()
	return last
}

func (u *User) Data() *DataUser {
	u.mutex.RLock()
	defer u.mutex.RUnlock()
	return &DataUser{
		Id:       u.Id,
		Sessions: len(u.sessionTable),
	}
}

func (u *User) SessionsData() []*DataSession {

	sessions := make([]*DataSession, 0, len(u.sessionTable))
	u.mutex.RLock()
	defer u.mutex.RUnlock()
	for _, session := range u.sessionTable {
		sessions = append(sessions, session.Data())
	}
	return sessions

}
