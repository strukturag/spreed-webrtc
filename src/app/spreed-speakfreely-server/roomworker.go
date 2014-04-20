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
	"encoding/json"
	"log"
	"sync"
	"time"
)

const (
	roomMaxWorkers     = 10000
	roomExpiryDuration = 60 * time.Second
)

type RoomConnectionUpdate struct {
	Id         string
	Sessionid  string
	Status     bool
	Connection *Connection
}

type RoomWorker struct {
	// References.
	h *Hub

	// Data handling.
	workers     chan (func())
	expired     chan (bool)
	connections map[string]*Connection
	timer       *time.Timer
	mutex       sync.RWMutex

	// Metadata.
	Id string
}

func NewRoomWorker(h *Hub, id string) *RoomWorker {

	log.Printf("Creating worker for room '%s'\n", id)

	r := &RoomWorker{
		h:  h,
		Id: id,
	}
	r.workers = make(chan func(), roomMaxWorkers)
	r.expired = make(chan bool)
	r.connections = make(map[string]*Connection)

	// Create expire timer.
	r.timer = time.AfterFunc(roomExpiryDuration, func() {
		r.expired <- true
	})

	return r

}

func (r *RoomWorker) Start() {

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
			if len(r.connections) == 0 {
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

func (r *RoomWorker) GetConnections() []*Connection {

	r.mutex.RLock()
	defer r.mutex.RUnlock()
	connections := make([]*Connection, 0, len(r.connections))
	for _, connection := range r.connections {
		connections = append(connections, connection)
	}
	return connections

}

func (r *RoomWorker) Run(f func()) bool {

	select {
	case r.workers <- f:
		return true
	default:
		log.Printf("Room worker channel full or closed '%s'\n", r.Id)
		return false
	}

}

func (r *RoomWorker) usersHandler(c *Connection) {

	worker := func() {
		sessions := &DataSessions{Type: "Users"}
		var sl []*DataSession
		appender := func(ec *Connection) bool {
			ecsession := ec.Session
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
		sl = make([]*DataSession, 0, len(r.connections))
		// Include connections in this room.
		for _, ec := range r.connections {
			if !appender(ec) {
				break
			}
		}
		r.mutex.RUnlock()
		// Include connections to global room.
		for _, ec := range c.h.GetGlobalConnections() {
			if !appender(ec) {
				break
			}
		}
		sessions.Users = sl
		sessionsJson := c.h.buffers.New()
		encoder := json.NewEncoder(sessionsJson)
		err := encoder.Encode(&DataOutgoing{From: c.Id, Data: sessions})
		if err != nil {
			log.Println("Users error while encoding JSON", err)
			sessionsJson.Decref()
			return
		}
		c.send(sessionsJson)
		sessionsJson.Decref()

	}

	r.Run(worker)

}

func (r *RoomWorker) broadcastHandler(m *MessageRequest) {

	worker := func() {
		r.mutex.RLock()
		defer r.mutex.RUnlock()
		for id, ec := range r.connections {
			if id == m.From {
				// Skip broadcast to self.
				continue
			}
			//fmt.Printf("%s\n", m.Message)
			ec.send(m.Message)
		}
		m.Message.Decref()
	}

	m.Message.Incref()
	r.Run(worker)

}

func (r *RoomWorker) connectionHandler(rcu *RoomConnectionUpdate) {

	worker := func() {
		r.mutex.Lock()
		defer r.mutex.Unlock()
		if rcu.Status {
			r.connections[rcu.Sessionid] = rcu.Connection
		} else {
			if _, ok := r.connections[rcu.Sessionid]; ok {
				delete(r.connections, rcu.Sessionid)
			}
		}
	}

	r.Run(worker)

}
