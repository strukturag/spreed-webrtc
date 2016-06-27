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
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/securecookie"
)

var sessionNonces *securecookie.SecureCookie

type Session struct {
	SessionManager    SessionManager
	Unicaster         Unicaster
	Broadcaster       Broadcaster
	RoomStatusManager RoomStatusManager
	buddyImages       ImageCache
	Id                string
	Sid               string
	Ua                string
	UpdateRev         uint64
	Status            interface{}
	Nonce             string
	Prio              int
	Hello             bool
	Roomid            string
	mutex             sync.RWMutex
	userid            string
	fake              bool
	stamp             int64
	attestation       *SessionAttestation
	attestations      *securecookie.SecureCookie
	subscriptions     map[string]*Session
	subscribers       map[string]*Session
	disconnected      bool
	replaced          bool
}

func NewSession(manager SessionManager,
	unicaster Unicaster,
	broadcaster Broadcaster,
	rooms RoomStatusManager,
	buddyImages ImageCache,
	attestations *securecookie.SecureCookie,
	id,
	sid string) *Session {
	session := &Session{
		SessionManager:    manager,
		Unicaster:         unicaster,
		Broadcaster:       broadcaster,
		RoomStatusManager: rooms,
		buddyImages:       buddyImages,
		Id:                id,
		Sid:               sid,
		Prio:              100,
		stamp:             time.Now().Unix(),
		attestations:      attestations,
		subscriptions:     make(map[string]*Session),
		subscribers:       make(map[string]*Session),
	}
	session.NewAttestation()

	return session
}

func (s *Session) authenticated() (authenticated bool) {
	authenticated = s.userid != ""
	return
}

func (s *Session) Subscribe(session *Session) {
	s.mutex.Lock()
	s.subscriptions[session.Id] = session
	s.mutex.Unlock()
	session.AddSubscriber(s)
}

func (s *Session) Unsubscribe(id string) {
	s.mutex.Lock()
	if session, ok := s.subscriptions[id]; ok {
		delete(s.subscriptions, id)
		s.mutex.Unlock()
		session.RemoveSubscriber(id)
	} else {
		s.mutex.Unlock()
	}
}

func (s *Session) AddSubscriber(session *Session) {
	s.mutex.Lock()
	s.subscribers[session.Id] = session
	s.mutex.Unlock()
}

func (s *Session) RemoveSubscriber(id string) {
	s.mutex.Lock()
	if _, ok := s.subscribers[id]; ok {
		delete(s.subscribers, id)
	}
	s.mutex.Unlock()
}

func (s *Session) JoinRoom(roomName, roomType string, credentials *DataRoomCredentials, sender Sender) (*DataRoom, error) {
	roomID := s.RoomStatusManager.MakeRoomID(roomName, roomType)
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.Hello && s.Roomid != roomID {
		s.doLeaveRoom("soft")
	}

	room, err := s.RoomStatusManager.JoinRoom(roomID, roomName, roomType, credentials, s, s.authenticated(), sender)
	if err == nil {
		s.Hello = true
		s.Roomid = roomID
		s.Broadcaster.Broadcast(s.Id, s.Roomid, &DataOutgoing{
			From: s.Id,
			A:    s.attestation.Token(),
			Data: &DataSession{
				Type:   "Joined",
				Id:     s.Id,
				Userid: s.userid,
				Ua:     s.Ua,
				Prio:   s.Prio,
				Status: s.Status,
			},
		})
	} else {
		s.Hello = false
	}

	return room, err
}

func (s *Session) doLeaveRoom(status string) {
	s.RoomStatusManager.LeaveRoom(s.Roomid, s.Id)
	s.Broadcaster.Broadcast(s.Id, s.Roomid, &DataOutgoing{
		From: s.Id,
		A:    s.attestation.Token(),
		Data: &DataSession{
			Type:   "Left",
			Id:     s.Id,
			Status: status,
		},
	})
	s.Hello = false
}

func (s *Session) LeaveRoom() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.Hello {
		return
	}

	s.doLeaveRoom("soft")
}

func (s *Session) Broadcast(m interface{}) {
	s.mutex.RLock()
	if s.Hello {
		s.Broadcaster.Broadcast(s.Id, s.Roomid, &DataOutgoing{
			From: s.Id,
			A:    s.attestation.Token(),
			Data: m,
		})
	}
	s.mutex.RUnlock()
}

func (s *Session) BroadcastStatus() {
	s.mutex.RLock()
	if s.Hello {
		s.Broadcaster.Broadcast(s.Id, s.Roomid, &DataOutgoing{
			From: s.Id,
			A:    s.attestation.Token(),
			Data: &DataSession{
				Type:   "Status",
				Id:     s.Id,
				Userid: s.userid,
				Status: s.Status,
				Rev:    s.UpdateRev,
				Prio:   s.Prio,
			},
		})
	}
	s.mutex.RUnlock()
}

func (s *Session) Unicast(to string, m interface{}, pipeline *Pipeline) {
	s.mutex.RLock()
	outgoing := &DataOutgoing{
		From: s.Id,
		To:   to,
		A:    s.attestation.Token(),
		Data: m,
	}
	s.mutex.RUnlock()

	s.Unicaster.Unicast(to, outgoing, pipeline)
}

func (s *Session) Close() {
	s.mutex.Lock()
	if s.disconnected {
		s.mutex.Unlock()
		return
	}

	// TODO(longsleep): Verify that it is ok to not do all this when replaced is true.
	if !s.replaced {

		outgoing := &DataOutgoing{
			From: s.Id,
			A:    s.attestation.Token(),
			Data: &DataSession{
				Type:   "Left",
				Id:     s.Id,
				Status: "hard",
			},
		}

		if s.Hello {
			// NOTE(lcooper): If we don't check for Hello here, we could deadlock
			// when implicitly creating a room while a user is reconnecting.
			s.Broadcaster.Broadcast(s.Id, s.Roomid, outgoing)
			s.RoomStatusManager.LeaveRoom(s.Roomid, s.Id)
		}

		for _, session := range s.subscribers {
			s.Unicaster.Unicast(session.Id, outgoing, nil)
		}

		for _, session := range s.subscriptions {
			session.RemoveSubscriber(s.Id)
			s.Unicaster.Unicast(session.Id, outgoing, nil)
		}

		s.SessionManager.DestroySession(s.Id, s.userid)
		s.buddyImages.Delete(s.Id)

	}

	s.subscriptions = make(map[string]*Session)
	s.subscribers = make(map[string]*Session)
	s.disconnected = true

	s.mutex.Unlock()
}

func (s *Session) Replace(oldSession *Session) {
	oldSession.mutex.Lock()
	if oldSession.disconnected {
		oldSession.mutex.Unlock()
		return
	}

	s.mutex.Lock()

	s.subscriptions = oldSession.subscriptions
	s.subscribers = oldSession.subscribers

	s.mutex.Unlock()

	// Mark old session as replaced.
	oldSession.replaced = true
	oldSession.mutex.Unlock()
}

func (s *Session) Update(update *SessionUpdate) uint64 {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if update.Status != nil {
		status, ok := update.Status.(map[string]interface{})
		if ok && status["buddyPicture"] != nil {
			pic := status["buddyPicture"].(string)
			if strings.HasPrefix(pic, "data:") {
				imageId := s.buddyImages.Update(s.Id, pic[5:])
				if imageId != "" {
					status["buddyPicture"] = "img:" + imageId
				}
			}
		}
	}

	for _, key := range update.Types {

		//fmt.Println("type update", key)
		switch key {
		case "Ua":
			s.Ua = update.Ua
		case "Status":
			s.Status = update.Status
		case "Prio":
			s.Prio = update.Prio
		}

	}

	s.UpdateRev++
	return s.UpdateRev
}

func (s *Session) Authorize(realm string, st *SessionToken) (string, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.Id != st.Id || s.Sid != st.Sid {
		return "", NewDataError("invalid_session_token", "session id mismatch")
	}
	if s.userid != "" {
		return "", NewDataError("already_authenticated", "session already authenticated")
	}

	// Create authentication nonce.
	var err error
	s.Nonce, err = sessionNonces.Encode(fmt.Sprintf("%s@%s", s.Sid, realm), st.Userid)
	if err != nil {
		err = NewDataError("unknown", err.Error())
	}

	return s.Nonce, err
}

func (s *Session) Authenticate(realm string, st *SessionToken, userid string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.userid != "" {
		return NewDataError("already_authenticated", "session already authenticated")
	}
	if userid == "" {
		if s.Nonce == "" || s.Nonce != st.Nonce {
			return NewDataError("invalid_session_token", "nonce validation failed")
		}
		err := sessionNonces.Decode(fmt.Sprintf("%s@%s", s.Sid, realm), st.Nonce, &userid)
		if err != nil {
			return NewDataError("invalid_session_token", err.Error())
		}
		if st.Userid != userid {
			return NewDataError("invalid_session_token", "user id mismatch")
		}
		s.Nonce = ""
	}

	s.userid = userid
	s.stamp = time.Now().Unix()
	s.UpdateRev++

	return nil
}

func (s *Session) Token() *SessionToken {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return &SessionToken{Id: s.Id, Sid: s.Sid, Userid: s.userid}
}

func (s *Session) Data() *DataSession {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return &DataSession{
		Id:     s.Id,
		Userid: s.userid,
		Ua:     s.Ua,
		Status: s.Status,
		Rev:    s.UpdateRev,
		Prio:   s.Prio,
		stamp:  s.stamp,
	}
}

func (s *Session) Userid() (userid string) {
	s.mutex.RLock()
	userid = s.userid
	s.mutex.RUnlock()

	return
}

func (s *Session) SetUseridFake(userid string) {
	s.mutex.Lock()
	s.userid = userid
	s.fake = true
	s.mutex.Unlock()
}

func (s *Session) NewAttestation() {
	s.attestation = &SessionAttestation{
		s: s,
	}
	s.attestation.Update()
}

func (s *Session) UpdateAttestation() (string, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return s.attestation.Update()
}

func (s *Session) DecodeAttestation(token string) (string, error) {
	return s.attestation.Decode(token)
}

func init() {
	// Create nonce generator.
	sessionNonces = securecookie.New(securecookie.GenerateRandomKey(64), nil)
	sessionNonces.MaxAge(60)
}
