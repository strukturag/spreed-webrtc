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
)

type RoomStatusManager interface {
	CanJoinRoom(id string) bool
	RoomUsers(*Session) []*DataSession
	JoinRoom(*Session, Sender)
	LeaveRoom(*Session)
}

type Broadcaster interface {
	Broadcast(*Session, interface{})
}

type RoomStats interface {
	RoomInfo(includeSessions bool) (count int, sessionInfo map[string][]string)
}

type RoomManager interface {
	RoomStatusManager
	Broadcaster
	RoomStats
}

type roomManager struct {
	sync.RWMutex
	OutgoingEncoder
	defaultRoomEnabled bool
	globalRoomID       string
	roomTable          map[string]RoomWorker
}

func NewRoomManager(config *Config, encoder OutgoingEncoder) RoomManager {
	return &roomManager{
		sync.RWMutex{},
		encoder,
		config.DefaultRoomEnabled,
		config.globalRoomid,
		make(map[string]RoomWorker),
	}
}

func (rooms *roomManager) CanJoinRoom(id string) bool {
	return id != "" || rooms.defaultRoomEnabled
}

func (rooms *roomManager) RoomUsers(session *Session) []*DataSession {
	return <-rooms.getRoomWorker(session.Roomid).GetUsers()
}

func (rooms *roomManager) JoinRoom(session *Session, sender Sender) {
	rooms.getRoomWorker(session.Roomid).Join(session, sender)
}

func (rooms *roomManager) LeaveRoom(session *Session) {
	rooms.getRoomWorker(session.Roomid).Leave(session)
}

func (rooms *roomManager) Broadcast(session *Session, m interface{}) {
	outgoing := &DataOutgoing{
		From: session.Id,
		A:    session.Attestation(),
		Data: m,
	}

	message, err := rooms.EncodeOutgoing(outgoing)
	if err != nil {
		return
	}

	id := session.Roomid
	if id != "" && id == rooms.globalRoomID {
		rooms.RLock()
		for _, room := range rooms.roomTable {
			room.Broadcast(session, message)
		}
		rooms.RUnlock()
	} else {
		room := rooms.getRoomWorker(id)
		room.Broadcast(session, message)
	}
	message.Decref()
}

func (rooms *roomManager) RoomInfo(includeSessions bool) (count int, sessionInfo map[string][]string) {
	rooms.RLock()
	defer rooms.RUnlock()

	count = len(rooms.roomTable)
	if includeSessions {
		sessionInfo := make(map[string][]string)
		for roomid, room := range rooms.roomTable {
			sessionInfo[roomid] = room.SessionIDs()
		}
	}
	return
}

func (rooms *roomManager) getRoomWorker(id string) RoomWorker {

	rooms.RLock()
	room, ok := rooms.roomTable[id]
	if !ok {
		rooms.RUnlock()
		rooms.Lock()
		// Need to re-check, another thread might have created the room
		// while we waited for the lock.
		room, ok = rooms.roomTable[id]
		if !ok {
			room = NewRoomWorker(rooms, id)
			rooms.roomTable[id] = room
			rooms.Unlock()
			go func() {
				// Start room, this blocks until room expired.
				room.Start()
				// Cleanup room when we are done.
				rooms.Lock()
				defer rooms.Unlock()
				delete(rooms.roomTable, id)
				log.Printf("Cleaned up room '%s'\n", id)
			}()
		} else {
			rooms.Unlock()
		}
	} else {
		rooms.RUnlock()
	}

	return room

}

func (rooms *roomManager) GlobalUsers() []*roomUser {
	if rooms.globalRoomID == "" {
		return make([]*roomUser, 0)
	}
	rooms.RLock()
	if room, ok := rooms.roomTable[rooms.globalRoomID]; ok {
		rooms.RUnlock()
		return room.Users()
	}

	rooms.RUnlock()
	return make([]*roomUser, 0)
}
