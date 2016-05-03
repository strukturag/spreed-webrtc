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
	"crypto/sha256"
	"net/http"
	"sync"

	"github.com/gorilla/securecookie"
)

type UserStats interface {
	UserInfo(bool) (int, map[string]*DataUser)
}

type SessionManager interface {
	UserStats
	SessionStore
	UserStore
	SessionCreator
	DestroySession(sessionID, userID string)
	Authenticate(*Session, *SessionToken, string) error
	GetUserSessions(session *Session, id string) []*DataSession
	DecodeSessionToken(token string) (st *SessionToken)
}

type sessionManager struct {
	sync.RWMutex
	Tickets
	Unicaster
	Broadcaster
	RoomStatusManager
	buddyImages          ImageCache
	config               *Config
	userTable            map[string]*User
	sessionTable         map[string]*Session
	sessionByUserIDTable map[string]*Session
	useridRetriever      func(*http.Request) (string, error)
	attestations         *securecookie.SecureCookie
}

func NewSessionManager(config *Config, tickets Tickets, unicaster Unicaster, broadcaster Broadcaster, rooms RoomStatusManager, buddyImages ImageCache, sessionSecret []byte) SessionManager {
	sessionManager := &sessionManager{
		sync.RWMutex{},
		tickets,
		unicaster,
		broadcaster,
		rooms,
		buddyImages,
		config,
		make(map[string]*User),
		make(map[string]*Session),
		make(map[string]*Session),
		nil,
		nil,
	}

	sessionManager.attestations = securecookie.New(sessionSecret, nil)
	sessionManager.attestations.MaxAge(300) // 5 minutes
	sessionManager.attestations.HashFunc(sha256.New)

	return sessionManager
}

func (sessionManager *sessionManager) UserInfo(details bool) (userCount int, users map[string]*DataUser) {
	sessionManager.RLock()
	defer sessionManager.RUnlock()

	userCount = len(sessionManager.userTable)
	if details {
		users := make(map[string]*DataUser)
		for userid, user := range sessionManager.userTable {
			users[userid] = user.Data()
		}
	}

	return
}

// GetSession returns the client-less sessions created directly by sessionManager.
func (sessionManager *sessionManager) GetSession(id string) (*Session, bool) {
	sessionManager.RLock()
	defer sessionManager.RUnlock()

	session, ok := sessionManager.sessionTable[id]
	return session, ok
}

func (sessionManager *sessionManager) GetUser(id string) (*User, bool) {
	sessionManager.RLock()
	defer sessionManager.RUnlock()

	user, ok := sessionManager.userTable[id]
	return user, ok
}

func (sessionManager *sessionManager) CreateSession(st *SessionToken, userid string) *Session {
	if st == nil {
		st = sessionManager.DecodeSessionToken("")
	}
	session := NewSession(sessionManager, sessionManager.Unicaster, sessionManager.Broadcaster, sessionManager.RoomStatusManager, sessionManager.buddyImages, sessionManager.attestations, st.Id, st.Sid)

	if userid != "" {
		// Errors are ignored here, session is returned without userID when auth failed.
		sessionManager.Authenticate(session, st, userid)
	}

	return session
}

func (sessionManager *sessionManager) DestroySession(sessionID, userID string) {
	if userID == "" {
		return
	}

	sessionManager.Lock()
	if user, ok := sessionManager.userTable[userID]; ok && user.RemoveSession(sessionID) {
		delete(sessionManager.userTable, userID)
	}
	if _, ok := sessionManager.sessionTable[sessionID]; ok {
		delete(sessionManager.sessionTable, sessionID)
	}
	if session, ok := sessionManager.sessionByUserIDTable[userID]; ok && session.Id == sessionID {
		delete(sessionManager.sessionByUserIDTable, sessionID)
	}
	sessionManager.Unlock()
}

func (sessionManager *sessionManager) Authenticate(session *Session, st *SessionToken, userid string) error {
	if err := session.Authenticate(sessionManager.Realm(), st, userid); err != nil {
		return err
	}

	// Authentication success.
	suserid := session.Userid()
	sessionManager.Lock()
	user, ok := sessionManager.userTable[suserid]
	if !ok {
		user = NewUser(suserid)
		sessionManager.userTable[suserid] = user
	}
	sessionManager.Unlock()
	user.AddSession(session)

	return nil
}

func (sessionManager *sessionManager) GetUserSessions(session *Session, userid string) (users []*DataSession) {
	var (
		user *User
		ok   bool
	)
	sessionManager.RLock()
	user, ok = sessionManager.userTable[userid]
	sessionManager.RUnlock()
	if !ok {
		// No user. Create fake session.
		sessionManager.Lock()
		session, ok := sessionManager.sessionByUserIDTable[userid]
		if !ok {
			st := sessionManager.FakeSessionToken(userid)
			session = NewSession(sessionManager, sessionManager.Unicaster, sessionManager.Broadcaster, sessionManager.RoomStatusManager, sessionManager.buddyImages, sessionManager.attestations, st.Id, st.Sid)
			session.SetUseridFake(st.Userid)
			sessionManager.sessionByUserIDTable[userid] = session
			sessionManager.sessionTable[session.Id] = session
		}
		sessionManager.Unlock()
		users = make([]*DataSession, 1, 1)
		users[0] = session.Data()
	} else {
		// Add sessions for foreign user.
		users = user.SubscribeSessions(session)
	}

	return
}
