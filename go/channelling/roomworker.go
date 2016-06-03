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
	"crypto/subtle"
	"log"
	"sync"
	"time"

	"github.com/strukturag/spreed-webrtc/go/buffercache"
)

const (
	roomMaxWorkers     = 10000
	roomExpiryDuration = 60 * time.Second
	maxUsersLength     = 5000
)

type RoomWorker interface {
	Start()
	SessionIDs() []string
	Users() []*roomUser
	Update(*DataRoom) error
	GetUsers() []*DataSession
	Broadcast(sessionID string, buf buffercache.Buffer)
	Join(*DataRoomCredentials, *Session, Sender) (*DataRoom, error)
	Leave(sessionID string)
	GetType() string
}

type roomWorker struct {
	// References.
	manager *roomManager

	// Data handling.
	workers chan (func())
	expired chan (bool)
	users   map[string]*roomUser
	timer   *time.Timer
	mutex   sync.RWMutex

	// Metadata.
	id          string
	name        string
	roomType    string
	credentials *DataRoomCredentials
}

type roomUser struct {
	*Session
	Sender
}

func NewRoomWorker(manager *roomManager, roomID, roomName, roomType string, credentials *DataRoomCredentials) RoomWorker {
	log.Printf("Creating worker for room '%s'\n", roomID)

	r := &roomWorker{
		manager:  manager,
		id:       roomID,
		name:     roomName,
		roomType: roomType,
		workers:  make(chan func(), roomMaxWorkers),
		expired:  make(chan bool),
		users:    make(map[string]*roomUser),
	}

	if credentials != nil && len(credentials.PIN) > 0 {
		r.credentials = credentials
	}

	// Create expire timer.
	r.timer = time.AfterFunc(roomExpiryDuration, func() {
		r.expired <- true
	})

	return r
}

func (r *roomWorker) Start() {
	// Main blocking worker.
L:
	for {
		r.timer.Reset(roomExpiryDuration)
		select {
		case w := <-r.workers:
			//fmt.Println("Running worker", r.Id, w)
			w()
		case <-r.expired:
			//fmt.Println("Work room expired", r.Id)
			//fmt.Println("Work room expired", r.Id, len(r.connections))
			r.mutex.RLock()
			if len(r.users) == 0 {
				// Cleanup room when it is empty.
				r.mutex.RUnlock()
				log.Printf("Room worker not in use - cleaning up '%s'\n", r.id)
				break L
			} else {
				r.mutex.RUnlock()
			}
		}
	}

	r.timer.Stop()
	close(r.workers)
	//fmt.Println("Exit worker", r.Id)
}

func (r *roomWorker) SessionIDs() []string {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	sessions := make([]string, 0, len(r.users))
	for id := range r.users {
		sessions = append(sessions, id)
	}

	return sessions
}

func (r *roomWorker) Users() []*roomUser {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	users := make([]*roomUser, 0, len(r.users))
	for _, user := range r.users {
		users = append(users, user)
	}

	return users
}

func (r *roomWorker) GetType() string {
	return r.roomType
}

func (r *roomWorker) Run(f func()) bool {
	select {
	case r.workers <- f:
		return true
	default:
		log.Printf("Room worker channel full or closed '%s'\n", r.id)
		return false
	}
}

func (r *roomWorker) Update(room *DataRoom) error {
	fault := make(chan error, 1)
	worker := func() {
		r.mutex.Lock()
		// Enforce room type and name.
		room.Type = r.roomType
		room.Name = r.name
		// Update credentials.
		if room.Credentials != nil {
			if len(room.Credentials.PIN) > 0 {
				r.credentials = room.Credentials
			} else {
				r.credentials = nil
			}
		}
		r.mutex.Unlock()
		fault <- nil
	}
	r.Run(worker)

	return <-fault
}

func (r *roomWorker) GetUsers() []*DataSession {
	out := make(chan []*DataSession, 1)
	worker := func() {
		var sl []*DataSession
		appender := func(user *roomUser) bool {
			ecsession := user.Session
			if ecsession != nil {
				session := ecsession.Data()
				session.Type = "Online"
				sl = append(sl, session)
				if len(sl) > maxUsersLength {
					log.Println("Limiting users response length in channel", r.id)
					return false
				}
			}
			return true
		}
		r.mutex.RLock()
		sl = make([]*DataSession, 0, len(r.users))
		// Include connections in this room.
		for _, user := range r.users {
			if !appender(user) {
				break
			}
		}
		r.mutex.RUnlock()
		if r.id != r.manager.globalRoomID {
			// Include connections to global room.
			for _, ec := range r.manager.GlobalUsers() {
				if !appender(ec) {
					break
				}
			}
		}

		out <- sl
	}

	r.Run(worker)
	return <-out
}

func (r *roomWorker) Broadcast(sessionID string, message buffercache.Buffer) {
	worker := func() {
		r.mutex.RLock()
		for id, user := range r.users {
			if id == sessionID || user.Sender == nil {
				// Skip broadcast to self or non existing sender.
				continue
			}
			//fmt.Printf("%s\n", m.Message)
			user.Send(message)
		}
		r.mutex.RUnlock()
		message.Decref()
	}

	message.Incref()
	r.Run(worker)
}

type joinResult struct {
	*DataRoom
	error
}

func (r *roomWorker) Join(credentials *DataRoomCredentials, session *Session, sender Sender) (*DataRoom, error) {
	results := make(chan joinResult, 1)
	worker := func() {
		r.mutex.Lock()
		if r.credentials == nil && credentials != nil {
			results <- joinResult{nil, NewDataError("authorization_not_required", "No credentials may be provided for this room")}
			r.mutex.Unlock()
			return
		} else if r.credentials != nil {
			if credentials == nil {
				results <- joinResult{nil, NewDataError("authorization_required", "Valid credentials are required to join this room")}
				r.mutex.Unlock()
				return
			}

			if len(r.credentials.PIN) != len(credentials.PIN) || subtle.ConstantTimeCompare([]byte(r.credentials.PIN), []byte(credentials.PIN)) != 1 {
				results <- joinResult{nil, NewDataError("invalid_credentials", "The provided credentials are incorrect")}
				r.mutex.Unlock()
				return
			}
		}

		r.users[session.Id] = &roomUser{session, sender}
		// NOTE(lcooper): Needs to be a copy, else we risk races with
		// a subsequent modification of room properties.
		result := joinResult{&DataRoom{Name: r.name, Type: r.roomType}, nil}
		r.mutex.Unlock()
		results <- result
	}
	r.Run(worker)
	result := <-results

	return result.DataRoom, result.error
}

func (r *roomWorker) Leave(sessionID string) {
	worker := func() {
		r.mutex.Lock()
		if _, ok := r.users[sessionID]; ok {
			delete(r.users, sessionID)
		}
		r.mutex.Unlock()
	}
	r.Run(worker)
}
