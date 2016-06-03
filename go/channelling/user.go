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
	"log"
	"sort"
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

// AddSession adds a session to the session table and returns true if
// s is the first session.
func (u *User) AddSession(s *Session) bool {
	first := false
	u.mutex.Lock()
	u.sessionTable[s.Id] = s
	if len(u.sessionTable) == 1 {
		log.Println("First session registered for user", u.Id)
		first = true
	}
	u.mutex.Unlock()

	return first
}

// RemoveSession removes a session from the session table abd returns
// true if no session is left left.
func (u *User) RemoveSession(sessionID string) bool {
	last := false
	u.mutex.Lock()
	delete(u.sessionTable, sessionID)
	if len(u.sessionTable) == 0 {
		log.Println("Last session unregistered for user", u.Id)
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

func (u *User) SubscribeSessions(from *Session) []*DataSession {
	sessions := make([]*DataSession, 0, len(u.sessionTable))
	u.mutex.RLock()
	defer u.mutex.RUnlock()
	for _, session := range u.sessionTable {
		// TODO(longsleep): This does lots of locks - check if these can be streamlined.
		from.Subscribe(session)
		sessions = append(sessions, session.Data())
	}
	sort.Sort(ByPrioAndStamp(sessions))

	return sessions
}

type ByPrioAndStamp []*DataSession

func (a ByPrioAndStamp) Len() int {
	return len(a)
}

func (a ByPrioAndStamp) Swap(i, j int) {
	a[i], a[j] = a[j], a[i]
}

func (a ByPrioAndStamp) Less(i, j int) bool {
	if a[i].Prio < a[j].Prio {
		return true
	}
	if a[i].Prio == a[j].Prio {
		return a[i].stamp < a[j].stamp
	}

	return false
}
