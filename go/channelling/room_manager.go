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
	"log"
	"sync"

	"github.com/nats-io/nats"
)

type RoomStatusManager interface {
	RoomUsers(*Session) []*DataSession
	JoinRoom(roomID, roomName, roomType string, credentials *DataRoomCredentials, session *Session, sessionAuthenticated bool, sender Sender) (*DataRoom, error)
	LeaveRoom(roomID, sessionID string)
	UpdateRoom(*Session, *DataRoom) (*DataRoom, error)
	MakeRoomID(roomName, roomType string) string
	Get(roomID string) (room RoomWorker, ok bool)
}

type Broadcaster interface {
	Broadcast(sessionID, roomID string, outgoing *DataOutgoing)
}

type RoomStats interface {
	RoomInfo(includeSessions bool) (count int, sessionInfo map[string][]string)
}

type RoomManager interface {
	RoomStatusManager
	Broadcaster
	RoomStats
	SetBusManager(bus BusManager) error
}

type roomManager struct {
	sync.RWMutex
	*Config
	OutgoingEncoder
	BusManager
	roomTypeSubscription *nats.Subscription
	roomTable            map[string]RoomWorker
	roomTypes            map[string]string
	globalRoomID         string
	defaultRoomID        string
}

type roomTypeMessage struct {
	Path string `json:"path"`
	Type string `json:"type"`
}

func NewRoomManager(config *Config, encoder OutgoingEncoder) RoomManager {
	rm := &roomManager{
		RWMutex:         sync.RWMutex{},
		Config:          config,
		OutgoingEncoder: encoder,
		roomTable:       make(map[string]RoomWorker),
		roomTypes:       make(map[string]string),
	}
	if config.GlobalRoomID != "" {
		rm.globalRoomID = rm.MakeRoomID(config.GlobalRoomID, "")
	}
	rm.defaultRoomID = rm.MakeRoomID("", "")
	return rm
}

func (rooms *roomManager) SetBusManager(BusManager BusManager) error {
	if rooms.roomTypeSubscription != nil {
		rooms.roomTypeSubscription.Unsubscribe()
		rooms.roomTypeSubscription = nil
	}
	rooms.BusManager = BusManager
	if rooms.BusManager != nil {
		sub, err := rooms.Subscribe("channelling.config.roomtype", rooms.setNatsRoomType)
		if err != nil {
			return err
		}
		rooms.roomTypeSubscription = sub
	}
	return nil
}

func (rooms *roomManager) setNatsRoomType(msg *roomTypeMessage) {
	if msg == nil {
		return
	}

	if msg.Type != "" {
		log.Printf("Setting room type for %s to %s\n", msg.Path, msg.Type)
		rooms.roomTypes[msg.Path] = msg.Type
	} else {
		log.Printf("Clearing room type for %s\n", msg.Path)
		delete(rooms.roomTypes, msg.Path)
	}
}

func (rooms *roomManager) RoomUsers(session *Session) []*DataSession {
	if room, ok := rooms.Get(session.Roomid); ok {
		return room.GetUsers()
	}
	// TODO(lcooper): This should return an error.
	return []*DataSession{}
}

func (rooms *roomManager) JoinRoom(roomID, roomName, roomType string, credentials *DataRoomCredentials, session *Session, sessionAuthenticated bool, sender Sender) (*DataRoom, error) {
	if roomID == rooms.defaultRoomID && !rooms.DefaultRoomEnabled {
		return nil, NewDataError("default_room_disabled", "The default room is not enabled")
	}

	roomWorker, err := rooms.GetOrCreate(roomID, roomName, roomType, credentials, sessionAuthenticated)
	if err != nil {
		return nil, err
	}

	return roomWorker.Join(credentials, session, sender)
}

func (rooms *roomManager) LeaveRoom(roomID, sessionID string) {
	if room, ok := rooms.Get(roomID); ok {
		room.Leave(sessionID)
	}
}

func (rooms *roomManager) UpdateRoom(session *Session, room *DataRoom) (*DataRoom, error) {
	var roomID string
	if room != nil {
		roomID = rooms.MakeRoomID(room.Name, room.Type)
	}
	if !session.Hello || session.Roomid != roomID {
		return nil, NewDataError("not_in_room", "Cannot update other rooms")
	}
	if roomWorker, ok := rooms.Get(session.Roomid); ok {
		return room, roomWorker.Update(room)
	}
	// Set default room type if room was not found.
	room.Type = rooms.RoomTypeDefault

	// TODO(lcooper): We should almost certainly return an error in this case.
	return room, nil
}

func (rooms *roomManager) Broadcast(sessionID, roomID string, outgoing *DataOutgoing) {
	message, err := rooms.EncodeOutgoing(outgoing)
	if err != nil {
		return
	}

	if roomID == rooms.globalRoomID {
		rooms.RLock()
		for _, room := range rooms.roomTable {
			room.Broadcast(sessionID, message)
		}
		rooms.RUnlock()
	} else if room, ok := rooms.Get(roomID); ok {
		room.Broadcast(sessionID, message)
	} else {
		log.Printf("No room named %s found for broadcast %#v", roomID, outgoing)
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

func (rooms *roomManager) Get(roomID string) (room RoomWorker, ok bool) {
	rooms.RLock()
	room, ok = rooms.roomTable[roomID]
	rooms.RUnlock()

	return
}

func (rooms *roomManager) GetOrCreate(roomID, roomName, roomType string, credentials *DataRoomCredentials, sessionAuthenticated bool) (RoomWorker, error) {
	if rooms.AuthorizeRoomJoin && rooms.UsersEnabled && !sessionAuthenticated {
		return nil, NewDataError("room_join_requires_account", "Room join requires a user account")
	}

	if room, ok := rooms.Get(roomID); ok {
		return room, nil
	}

	if roomType == "" {
		roomType = rooms.getConfiguredRoomType(roomName)
	}

	rooms.Lock()
	// Need to re-check, another thread might have created the room
	// while we waited for the lock.
	if room, ok := rooms.roomTable[roomID]; ok {
		rooms.Unlock()
		return room, nil
	}

	if rooms.UsersEnabled && rooms.AuthorizeRoomCreation && !sessionAuthenticated {
		rooms.Unlock()
		return nil, NewDataError("room_join_requires_account", "Room creation requires a user account")
	}

	room := NewRoomWorker(rooms, roomID, roomName, roomType, credentials)
	rooms.roomTable[roomID] = room
	rooms.Unlock()
	go func() {
		// Start room, this blocks until room expired.
		room.Start()
		// Cleanup room when we are done.
		rooms.Lock()
		defer rooms.Unlock()
		delete(rooms.roomTable, roomID)
		log.Printf("Cleaned up room '%s'\n", roomID)
	}()

	return room, nil
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

func (rooms *roomManager) MakeRoomID(roomName, roomType string) string {
	if roomType == "" {
		roomType = rooms.getConfiguredRoomType(roomName)
	}

	return fmt.Sprintf("%s:%s", roomType, roomName)
}

func (rooms *roomManager) getConfiguredRoomType(roomName string) string {
	if roomType, found := rooms.roomTypes[roomName]; found {
		// Type of this room was overwritten through NATS.
		return roomType
	}

	for re, roomType := range rooms.RoomTypes {
		if re.MatchString(roomName) {
			return roomType
		}
	}

	return rooms.RoomTypeDefault
}
