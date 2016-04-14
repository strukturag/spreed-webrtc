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

type DataError struct {
	Type    string
	Code    string
	Message string
}

func NewDataError(code, message string) error {
	return &DataError{"Error", code, message}
}

func (err *DataError) Error() string {
	return err.Message
}

type DataRoomCredentials struct {
	PIN string
}

type DataHello struct {
	Version     string
	Ua          string
	Id          string // Compatibility with old clients.
	Name        string // Room name.
	Type        string // Room type.
	Credentials *DataRoomCredentials
}

type DataWelcome struct {
	Type  string
	Room  *DataRoom
	Users []*DataSession
}

type DataRoom struct {
	Type        string // Room type.
	Name        string // Room name.
	Credentials *DataRoomCredentials
}

type DataOffer struct {
	Type  string
	To    string
	Offer map[string]interface{}
}

type DataCandidate struct {
	Type      string
	To        string
	Candidate interface{}
}

type DataAnswer struct {
	Type   string
	To     string
	Answer map[string]interface{}
}

type DataSelf struct {
	Type       string
	Id         string
	Sid        string
	Userid     string
	Suserid    string
	Token      string
	Version    string  // Server version.
	ApiVersion float64 // Server channelling API version.
	Turn       *DataTurn
	Stun       []string
}

type DataTurn struct {
	Username string   `json:"username"`
	Password string   `json:"password"`
	Ttl      int      `json:"ttl"`
	Urls     []string `json:"urls"`
}

type DataSession struct {
	Type    string
	Id      string
	Userid  string      `json:",omitempty"`
	Ua      string      `json:",omitempty"`
	Token   string      `json:",omitempty"`
	Version string      `json:",omitempty"`
	Rev     uint64      `json:",omitempty"`
	Prio    int         `json:",omitempty"`
	Status  interface{} `json:",omitempty"`
	stamp   int64
}

type DataUser struct {
	Id       string
	Sessions int
}

type DataBye struct {
	Type string
	To   string
	Bye  interface{}
}

type DataStatus struct {
	Type   string
	Status interface{}
}

type DataChat struct {
	To   string
	Type string
	Chat *DataChatMessage
}

type DataChatMessage struct {
	Message string
	Time    string
	NoEcho  bool   `json:",omitempty"`
	Mid     string `json:",omitempty"`
	Status  *DataChatStatus
}

type DataChatStatus struct {
	Typing         string              `json:",omitempty"`
	State          string              `json:",omitempty"`
	Mid            string              `json:",omitempty"`
	SeenMids       []string            `json:",omitempty"`
	FileInfo       *DataFileInfo       `json:",omitempty"`
	Geolocation    *DataGeolocation    `json:",omitempty"`
	ContactRequest *DataContactRequest `json:",omitempty"`
	AutoCall       *DataAutoCall       `json:",omitempty"`
}

type DataFileInfo struct {
	Id     string `json:"id"`
	Chunks uint64 `json:"chunks"`
	Name   string `json:"name"`
	Size   uint64 `json:"size"`
	Type   string `json:"type"`
}

type DataGeolocation struct {
	Accuracy         float64 `json:"accuracy,omitempty"`
	Latitude         float64 `json:"latitude,omitempty"`
	Longitude        float64 `json:"longitude,omitempty"`
	Altitude         float64 `json:"altitude,omitempty"`
	AltitudeAccuracy float64 `json:"altitudeAccuracy,omitempty"`
}

type DataContactRequest struct {
	Id      string
	Success bool
	Userid  string `json:",omitempty"`
	Token   string `json:",omitempty"`
}

type DataAutoCall struct {
	Id   string
	Type string
}

type DataIncoming struct {
	Type           string
	Hello          *DataHello          `json:",omitempty"`
	Offer          *DataOffer          `json:",omitempty"`
	Candidate      *DataCandidate      `json:",omitempty"`
	Answer         *DataAnswer         `json:",omitempty"`
	Bye            *DataBye            `json:",omitempty"`
	Status         *DataStatus         `json:",omitempty"`
	Chat           *DataChat           `json:",omitempty"`
	Conference     *DataConference     `json:",omitempty"`
	Alive          *DataAlive          `json:",omitempty"`
	Authentication *DataAuthentication `json:",omitempty"`
	Sessions       *DataSessions       `json:",omitempty"`
	Room           *DataRoom           `json:",omitempty"`
	Iid            string              `json:",omitempty"`
}

type DataOutgoing struct {
	Data interface{} `json:",omitempty"`
	From string      `json:",omitempty"`
	To   string      `json:",omitempty"`
	Iid  string      `json:",omitempty"`
	A    string      `json:",omitempty"`
}

type DataSessions struct {
	Type     string
	Sessions *DataSessionsRequest `json:",omitempty"`
	Users    []*DataSession
}

type DataSessionsRequest struct {
	Token string
	Type  string
}

type DataConference struct {
	Id         string
	Type       string
	Conference []string
}

type DataAlive struct {
	Type  string
	Alive uint64
}

type DataAuthentication struct {
	Type           string
	Authentication *SessionToken
}
