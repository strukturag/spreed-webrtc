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
	"log"
	"sync"
	"time"
)

const (
	roomMaxWorkers     = 10000
	roomExpiryDuration = 60 * time.Second
)

type RoomWorker interface {
	Start()
	SessionIDs() []string
	Users() []*roomUser
	GetUsers() <-chan []*DataSession
	Broadcast(*Session, Buffer)
	Join(*Session, Sender)
	Leave(*Session)
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
	Id string
}

type roomUser struct {
	*Session
	Sender
}

func NewRoomWorker(manager *roomManager, id string) RoomWorker {

	log.Printf("Creating worker for room '%s'\n", id)

	r := &roomWorker{
		manager: manager,
		Id:      id,
		workers: make(chan func(), roomMaxWorkers),
		expired: make(chan bool),
		users:   make(map[string]*roomUser),
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
				log.Printf("Room worker not in use - cleaning up '%s'\n", r.Id)
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

func (r *roomWorker) Run(f func()) bool {

	select {
	case r.workers <- f:
		return true
	default:
		log.Printf("Room worker channel full or closed '%s'\n", r.Id)
		return false
	}

}

func (r *roomWorker) GetUsers() <-chan []*DataSession {
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
					log.Println("Limiting users response length in channel", r.Id)
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
		// Include connections to global room.
		for _, ec := range r.manager.GlobalUsers() {
			if !appender(ec) {
				break
			}
		}

		out <- sl
	}

	r.Run(worker)
	return out
}

func (r *roomWorker) Broadcast(session *Session, message Buffer) {

	worker := func() {
		r.mutex.RLock()
		defer r.mutex.RUnlock()
		for id, user := range r.users {
			if id == session.Id {
				// Skip broadcast to self.
				continue
			}
			//fmt.Printf("%s\n", m.Message)
			user.Send(message)
		}
		message.Decref()
	}

	message.Incref()
	r.Run(worker)

}

func (r *roomWorker) Join(session *Session, sender Sender) {
	worker := func() {
		r.mutex.Lock()
		defer r.mutex.Unlock()
		r.users[session.Id] = &roomUser{session, sender}
	}
	r.Run(worker)
}

func (r *roomWorker) Leave(session *Session) {
	worker := func() {
		r.mutex.Lock()
		defer r.mutex.Unlock()
		if _, ok := r.users[session.Id]; ok {
			delete(r.users, session.Id)
		}
	}
	r.Run(worker)
}
