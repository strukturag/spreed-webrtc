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
	"errors"
	"fmt"
	"testing"
)

type fakeClient struct {
}

func (fake *fakeClient) Send(_ Buffer) {
}

type fakeRoomManager struct {
	joinedRoomID string
	leftRoomID   string
	roomUsers    []*DataSession
	joinedID     string
	joinError    error
	leftID       string
	broadcasts   []interface{}
	updatedRoom  *DataRoom
	updateError  error
}

func (fake *fakeRoomManager) RoomUsers(session *Session) []*DataSession {
	return fake.roomUsers
}

func (fake *fakeRoomManager) JoinRoom(id, roomName, roomType string, _ *DataRoomCredentials, session *Session, sessionAuthenticated bool, _ Sender) (*DataRoom, error) {
	fake.joinedID = id
	return &DataRoom{Name: roomName, Type: roomType}, fake.joinError
}

func (fake *fakeRoomManager) LeaveRoom(roomID, sessionID string) {
	fake.leftID = roomID
}

func (fake *fakeRoomManager) Broadcast(_, _ string, outgoing *DataOutgoing) {
	fake.broadcasts = append(fake.broadcasts, outgoing.Data)
}

func (fake *fakeRoomManager) UpdateRoom(_ *Session, _ *DataRoom) (*DataRoom, error) {
	return fake.updatedRoom, fake.updateError
}

func (fake *fakeRoomManager) MakeRoomID(roomName, roomType string) string {
	if roomType == "" {
		roomType = "Room"
	}
	return fmt.Sprintf("%s:%s", roomType, roomName)
}

func NewTestChannellingAPI() (ChannellingAPI, *fakeClient, *Session, *fakeRoomManager) {
	client, roomManager := &fakeClient{}, &fakeRoomManager{}
	session := &Session{
		attestations:      sessionNonces,
		Broadcaster:       roomManager,
		RoomStatusManager: roomManager,
	}
	session.attestation = &SessionAttestation{s: session}
	return NewChannellingAPI(nil, roomManager, nil, nil, nil, nil, nil, nil), client, session, roomManager
}

func Test_ChannellingAPI_OnIncoming_HelloMessage_JoinsTheSelectedRoom(t *testing.T) {
	roomID, roomName, ua := "Room:foobar", "foobar", "unit tests"
	api, client, session, roomManager := NewTestChannellingAPI()

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomName, Ua: ua}})

	if roomManager.joinedID != roomID {
		t.Errorf("Expected to have joined room %v, but got %v", roomID, roomManager.joinedID)
	}

	if broadcastCount := len(roomManager.broadcasts); broadcastCount != 1 {
		t.Fatalf("Expected 1 broadcast, but got %d", broadcastCount)
	}

	dataSession, ok := roomManager.broadcasts[0].(*DataSession)
	if !ok {
		t.Fatal("Expected a session data broadcast")
	}

	if dataSession.Ua != ua {
		t.Errorf("Expected to have broadcasted a user agent of %v, but was %v", ua, dataSession.Ua)
	}
}

func Test_ChannellingAPI_OnIncoming_HelloMessage_LeavesAnyPreviouslyJoinedRooms(t *testing.T) {
	roomID, roomName := "Room:foobar", "foobar"
	api, client, session, roomManager := NewTestChannellingAPI()

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomName}})
	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: "baz"}})

	if roomManager.leftID != roomID {
		t.Errorf("Expected to have left room %v, but got %v", roomID, roomManager.leftID)
	}

	if broadcastCount := len(roomManager.broadcasts); broadcastCount != 3 {
		t.Fatalf("Expected 3 broadcasts, but got %d", broadcastCount)
	}

	dataSession, ok := roomManager.broadcasts[1].(*DataSession)
	if !ok {
		t.Fatal("Expected a session data broadcast")
	}

	if status := "soft"; dataSession.Status != status {
		t.Errorf("Expected to have broadcast a leave status of of %v, but was %v", status, dataSession.Status)
	}
}

func Test_ChannellingAPI_OnIncoming_HelloMessage_DoesNotJoinIfNotPermitted(t *testing.T) {
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.joinError = errors.New("Can't enter this room")

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{}})

	if broadcastCount := len(roomManager.broadcasts); broadcastCount != 0 {
		t.Fatalf("Expected no broadcasts, but got %d", broadcastCount)
	}
}

func Test_ChannellingAPI_OnIncoming_HelloMessage_RespondsWithAWelcome(t *testing.T) {
	roomID := "a-room"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.roomUsers = []*DataSession{&DataSession{}}

	reply, err := api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomID}})
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}

	welcome, ok := reply.(*DataWelcome)
	if !ok {
		t.Fatalf("Expected response %#v to be a Welcome", reply)
	}

	if welcome.Type != "Welcome" {
		t.Error("Message did not have the correct type")
	}

	if welcome.Room == nil || welcome.Room.Name != roomID {
		t.Errorf("Expected room with name %v, but got %#v", roomID, welcome.Room)
	}

	if len(welcome.Users) != len(roomManager.roomUsers) {
		t.Errorf("Expected to get users %#v, but was %#v", roomManager.roomUsers, welcome.Users)
	}
}

func Test_ChannellingAPI_OnIncoming_HelloMessage_RespondsWithAnErrorIfTheRoomCannotBeJoined(t *testing.T) {
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.joinError = NewDataError("bad_join", "")

	_, err := api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{}})

	assertDataError(t, err, "bad_join")
}

func Test_ChannellingAPI_OnIncoming_RoomMessage_RespondsWithAndBroadcastsTheUpdatedRoom(t *testing.T) {
	roomName := "foo"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.updatedRoom = &DataRoom{Name: "FOO"}

	_, err := api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomName}})
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}

	reply, err := api.OnIncoming(client, session, &DataIncoming{Type: "Room", Room: &DataRoom{Name: roomName}})
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}

	room, ok := reply.(*DataRoom)
	if !ok {
		t.Fatalf("Expected response message to be a Room")
	}

	if room.Name != roomManager.updatedRoom.Name {
		t.Errorf("Expected updated room with name %v, but got %#v", roomManager.updatedRoom, room)
	}

	if broadcastCount := len(roomManager.broadcasts); broadcastCount != 2 {
		t.Fatalf("Expected 1 broadcasts, but got %d", broadcastCount)
	}

	if _, ok := roomManager.broadcasts[1].(*DataRoom); !ok {
		t.Fatal("Expected a room data broadcast")
	}
}

func Test_ChannellingAPI_OnIncoming_RoomMessage_RespondsWithAnErrorIfUpdatingTheRoomFails(t *testing.T) {
	roomName := "foo"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.updateError = NewDataError("a_room_error", "")

	_, err := api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomName}})
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}
	_, err = api.OnIncoming(client, session, &DataIncoming{Type: "Room", Room: &DataRoom{Name: roomName}})

	assertDataError(t, err, "a_room_error")
}
