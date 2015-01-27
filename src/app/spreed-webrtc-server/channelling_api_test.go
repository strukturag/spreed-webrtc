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
	"errors"
	"testing"
)

type fakeClient struct {
	replies map[string]interface{}
}

func (fake *fakeClient) Send(_ Buffer) {
}

func (fake *fakeClient) Reply(iid string, msg interface{}) {
	if fake.replies == nil {
		fake.replies = make(map[string]interface{})
	}

	fake.replies[iid] = msg
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

func (fake *fakeRoomManager) JoinRoom(id string, _ *DataRoomCredentials, session *Session, _ Sender) (*DataRoom, error) {
	fake.joinedID = id
	return &DataRoom{Name: id}, fake.joinError
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

func assertReply(t *testing.T, client *fakeClient, iid string) interface{} {
	msg, ok := client.replies[iid]
	if !ok {
		t.Fatalf("No response received for Iid %v", iid)
	}
	return msg
}

func assertErrorReply(t *testing.T, client *fakeClient, iid, code string) {
	err, ok := assertReply(t, client, iid).(*DataError)
	if !ok {
		t.Fatalf("Expected response message to be an Error")
	}

	if err.Type != "Error" {
		t.Error("Message did not have the correct type")
	}

	if err.Code != code {
		t.Errorf("Expected error code to be %v, but was %v", code, err.Code)
	}
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
	roomID, ua := "foobar", "unit tests"
	api, client, session, roomManager := NewTestChannellingAPI()

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomID, Ua: ua}})

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
	roomID := "foobar"
	api, client, session, roomManager := NewTestChannellingAPI()

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Hello: &DataHello{Id: roomID}})
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

func Test_ChannellingAPI_OnIncoming_HelloMessageWithAnIid_RespondsWithAWelcome(t *testing.T) {
	iid, roomID := "foo", "a-room"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.roomUsers = []*DataSession{&DataSession{}}

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Iid: iid, Hello: &DataHello{Id: roomID}})

	msg, ok := client.replies[iid]
	if !ok {
		t.Fatalf("No response received for Iid %v", iid)
	}

	welcome, ok := msg.(*DataWelcome)
	if !ok {
		t.Fatalf("Expected response message %#v to be a Welcome", msg)
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

func Test_ChannellingAPI_OnIncoming_HelloMessageWithAnIid_RespondsWithAnErrorIfTheRoomCannotBeJoined(t *testing.T) {
	iid := "foo"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.joinError = NewDataError("bad_join", "")

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Iid: iid, Hello: &DataHello{}})

	assertErrorReply(t, client, iid, "bad_join")
}

func Test_ChannellingAPI_OnIncoming_RoomMessage_RespondsWithAndBroadcastsTheUpdatedRoom(t *testing.T) {
	iid, roomName := "123", "foo"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.updatedRoom = &DataRoom{Name: "FOO"}

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Iid: "0", Hello: &DataHello{Id: roomName}})
	api.OnIncoming(client, session, &DataIncoming{Type: "Room", Iid: iid, Room: &DataRoom{Name: roomName}})

	room, ok := assertReply(t, client, iid).(*DataRoom)
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
	iid, roomName := "123", "foo"
	api, client, session, roomManager := NewTestChannellingAPI()
	roomManager.updateError = NewDataError("a_room_error", "")

	api.OnIncoming(client, session, &DataIncoming{Type: "Hello", Iid: "0", Hello: &DataHello{Id: roomName}})
	api.OnIncoming(client, session, &DataIncoming{Type: "Room", Iid: iid, Room: &DataRoom{Name: roomName}})

	assertErrorReply(t, client, iid, "a_room_error")
}
