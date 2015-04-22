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

package main

import (
	"testing"
)

func NewTestRoomManager() (RoomManager, *Config) {
	config := &Config{}
	return NewRoomManager(config, nil), config
}

func Test_RoomManager_JoinRoom_ReturnsAnErrorForUnauthenticatedSessionsWhenCreationRequiresAnAccount(t *testing.T) {
	roomManager, config := NewTestRoomManager()
	config.UsersEnabled = true
	config.AuthorizeRoomCreation = true

	unauthenticatedSession := &Session{}
	_, err := roomManager.JoinRoom("Room:foo", "foo", "Room", nil, unauthenticatedSession, false, nil)
	assertDataError(t, err, "room_join_requires_account")

	authenticatedSession := &Session{userid: "9870457"}
	_, err = roomManager.JoinRoom("Room:foo", "foo", "Room", nil, authenticatedSession, true, nil)
	if err != nil {
		t.Fatalf("Unexpected error %v joining room while authenticated", err)
	}

	_, err = roomManager.JoinRoom("Room:foo", "foo", "Room", nil, unauthenticatedSession, false, nil)
	if err != nil {
		t.Fatalf("Unexpected error %v joining room while unauthenticated", err)
	}
}

func Test_RoomManager_JoinRoom_ReturnsAnErrorForUnauthenticatedSessionsWhenJoinRequiresAnAccount(t *testing.T) {
	roomManager, config := NewTestRoomManager()
	config.UsersEnabled = true
	config.AuthorizeRoomJoin = true

	unauthenticatedSession := &Session{}
	_, err := roomManager.JoinRoom("Room:foo", "foo", "Room", nil, unauthenticatedSession, false, nil)
	assertDataError(t, err, "room_join_requires_account")

	authenticatedSession := &Session{userid: "9870457"}
	_, err = roomManager.JoinRoom("Room:foo", "foo", "Room", nil, authenticatedSession, true, nil)
	if err != nil {
		t.Fatalf("Unexpected error %v joining room while authenticated", err)
	}

	_, err = roomManager.JoinRoom("Room:foo", "foo", "Room", nil, unauthenticatedSession, false, nil)
	assertDataError(t, err, "room_join_requires_account")
}

func Test_RoomManager_UpdateRoom_ReturnsAnErrorIfNoRoomHasBeenJoined(t *testing.T) {
	roomManager, _ := NewTestRoomManager()
	_, err := roomManager.UpdateRoom(&Session{}, nil)

	assertDataError(t, err, "not_in_room")
}

func Test_RoomManager_UpdateRoom_ReturnsAnErrorIfUpdatingAnUnjoinedRoom(t *testing.T) {
	roomManager, _ := NewTestRoomManager()
	session := &Session{Hello: true, Roomid: "Room:foo"}
	_, err := roomManager.UpdateRoom(session, &DataRoom{Name: "bar"})
	assertDataError(t, err, "not_in_room")
}

func Test_RoomManager_UpdateRoom_ReturnsACorrectlyTypedDocument(t *testing.T) {
	roomManager, _ := NewTestRoomManager()
	session := &Session{Hello: true, Roomid: "Room:foo"}
	room, err := roomManager.UpdateRoom(session, &DataRoom{Name: "foo"})
	if err != nil {
		t.Fatalf("Unexpected error %v updating room", err)
	}

	if room.Type != "Room" {
		t.Errorf("Expected document type to be Room, but was %v", room.Type)
	}
}
