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
	"testing"

	"github.com/strukturag/spreed-webrtc/go/channelling"
)

const (
	testRoomID   string = channelling.RoomTypeRoom + ":a-room-name"
	testRoomName string = "a-room-name"
	testRoomType string = channelling.RoomTypeRoom
)

func NewTestRoomWorker() RoomWorker {
	worker := NewRoomWorker(&roomManager{Config: &Config{}}, testRoomID, testRoomName, testRoomType, nil)
	go worker.Start()
	return worker
}

func NewTestRoomWorkerWithPIN(t *testing.T) (RoomWorker, string) {
	pin := "asdf"
	worker := NewRoomWorker(&roomManager{Config: &Config{}}, testRoomID, testRoomName, testRoomType, &DataRoomCredentials{PIN: pin})
	go worker.Start()
	return worker, pin
}

func Test_RoomWorker_Join_SucceedsWhenNoCredentialsAreRequired(t *testing.T) {
	worker := NewTestRoomWorker()

	_, err := worker.Join(nil, &Session{}, nil)
	if err != nil {
		t.Fatalf("Unexpected error %v", err)
	}

	if userCount := len(worker.GetUsers()); userCount != 1 {
		t.Errorf("Expected join to have been accepted but room contains %d users", userCount)
	}
}

func Test_RoomWorker_Join_FailsIfCredentialsAreGivenWhenUnneeded(t *testing.T) {
	worker := NewTestRoomWorker()

	_, err := worker.Join(&DataRoomCredentials{}, &Session{}, nil)

	assertDataError(t, err, "authorization_not_required")
	if userCount := len(worker.GetUsers()); userCount != 0 {
		t.Errorf("Expected join to have been rejected but room contains %d users", userCount)
	}
}

func Test_RoomWorker_Join_FailsIfNoCredentialsAreGiven(t *testing.T) {
	worker, _ := NewTestRoomWorkerWithPIN(t)

	_, err := worker.Join(nil, &Session{}, nil)

	assertDataError(t, err, "authorization_required")
	if userCount := len(worker.GetUsers()); userCount != 0 {
		t.Errorf("Expected join to have been rejected but room contains %d users", userCount)
	}
}

func Test_RoomWorker_Join_FailsIfIncorrectCredentialsAreGiven(t *testing.T) {
	worker, _ := NewTestRoomWorkerWithPIN(t)

	_, err := worker.Join(&DataRoomCredentials{PIN: "adfs"}, &Session{}, nil)

	assertDataError(t, err, "invalid_credentials")
	if userCount := len(worker.GetUsers()); userCount != 0 {
		t.Errorf("Expected join to have been rejected but room contains %d users", userCount)
	}
}

func Test_RoomWorker_Join_SucceedsWhenTheCorrectPINIsGiven(t *testing.T) {
	worker, pin := NewTestRoomWorkerWithPIN(t)

	if _, err := worker.Join(&DataRoomCredentials{PIN: pin}, &Session{}, nil); err != nil {
		t.Fatalf("Unexpected error %v", err)
	}

	if len(worker.GetUsers()) < 1 {
		t.Error("Expected join to have been accepted but room contains no users")
	}
}

func Test_RoomWorker_Update_AllowsClearingCredentials(t *testing.T) {
	worker, _ := NewTestRoomWorkerWithPIN(t)

	if err := worker.Update(&DataRoom{Credentials: &DataRoomCredentials{PIN: ""}}); err != nil {
		t.Fatalf("Failed to update room: %v", err)
	}

	_, err := worker.Join(&DataRoomCredentials{}, &Session{}, nil)
	assertDataError(t, err, "authorization_not_required")
}

func Test_RoomWorker_Update_RetainsCredentialsWhenOtherPropertiesAreUpdated(t *testing.T) {
	worker, pin := NewTestRoomWorkerWithPIN(t)

	if err := worker.Update(&DataRoom{}); err != nil {
		t.Fatalf("Failed to update room: %v", err)
	}

	if _, err := worker.Join(&DataRoomCredentials{PIN: pin}, &Session{}, nil); err != nil {
		t.Fatalf("Unexpected error joining room %v", err)
	}
}
