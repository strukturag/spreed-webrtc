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

type DataHello struct {
	Version string
	Ua      string
	Id      string
}

type DataOffer struct {
	Type  string
	To    string
	Offer interface{}
}

type DataCandidate struct {
	Type      string
	To        string
	Candidate interface{}
}

type DataAnswer struct {
	Type   string
	To     string
	Answer interface{}
}

type DataSelf struct {
	Type    string
	Id      string
	Token   string
	Version string
	Turn    *DataTurn
	Stun    []string
}

type DataTurn struct {
	Username string   `json:"username"`
	Password string   `json:"password"`
	Ttl      int      `json:"ttl"`
	Urls     []string `json:"urls"`
}

type DataUser struct {
	Type    string
	Id      string
	Ua      string
	Token   string
	Version string
	Rev     uint64
	Status  interface{}
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
	Mid     string
	Message string
	Time    string
	NoEcho  bool `json:"NoEcho,omitempty"`
	Status  interface{}
}

type DataChatMessageStatus struct {
	State string
	Mid   string
}

type DataIncoming struct {
	Type       string
	Hello      *DataHello
	Offer      *DataOffer
	Candidate  *DataCandidate
	Answer     *DataAnswer
	Bye        *DataBye
	Status     *DataStatus
	Chat       *DataChat
	Conference *DataConference
	Alive      *DataAlive
}

type DataOutgoing struct {
	Data interface{}
	From string
	To   string
}

type DataUsers struct {
	Type  string
	Users []*DataUser
	Index uint64
	Batch uint64
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
