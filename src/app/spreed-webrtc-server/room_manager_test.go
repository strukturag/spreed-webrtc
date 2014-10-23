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
	"testing"
)

func NewTestRoomManager() RoomManager {
	return NewRoomManager(&Config{}, nil)
}

func assertDataError(t *testing.T, err error, code string) {
	dataError, ok := err.(*DataError)
	if !ok {
		t.Errorf("Expected error %#v to be a *DataError", err)
		return
	}

	if code != dataError.Code {
		t.Errorf("Expected error code to be %v, but was %v", code, dataError.Code)
	}
}

func Test_RoomManager_UpdateRoom_ReturnsAnErrorIfNoRoomHasBeenJoined(t *testing.T) {
	roomManager := NewTestRoomManager()
	_, err := roomManager.UpdateRoom(&Session{}, nil)

	assertDataError(t, err, "not_in_room")
}

func Test_RoomManager_UpdateRoom_ReturnsAnErrorIfUpdatingAnUnjoinedRoom(t *testing.T) {
	roomManager := NewTestRoomManager()
	session := &Session{Hello: true, Roomid: "foo"}
	_, err := roomManager.UpdateRoom(session, &DataRoom{Name: "bar"})
	assertDataError(t, err, "not_in_room")
}

func Test_RoomManager_UpdateRoom_ReturnsACorrectlyTypedDocument(t *testing.T) {
	roomManager := NewTestRoomManager()
	session := &Session{Hello: true, Roomid: "foo"}
	room, err := roomManager.UpdateRoom(session, &DataRoom{Name: session.Roomid})
	if err != nil {
		t.Fatalf("Unexpected error %v updating room", err)
	}

	if room.Type != "Room" {
		t.Errorf("Expected document type to be Room, but was %v", room.Type)
	}
}
