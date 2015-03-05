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
)

type Sender interface {
	Send(Buffer)
}

type ResponseSender interface {
	Sender
	Responder
}

type Responder interface {
	Reply(iid string, m interface{})
}

type Client interface {
	ResponseSender
	Session() *Session
	Index() uint64
	Close()
	ReplaceAndClose()
}

type client struct {
	Codec
	ChannellingAPI
	Connection
	session *Session
}

func NewClient(codec Codec, api ChannellingAPI, session *Session) *client {
	return &client{codec, api, nil, session}
}

func (client *client) OnConnect(conn Connection) {
	client.Connection = conn
	client.ChannellingAPI.OnConnect(client, client.session)
}

func (client *client) OnDisconnect() {
	client.session.Close()
	client.ChannellingAPI.OnDisconnect(client, client.session)
}

func (client *client) OnText(b Buffer) {
	if incoming, err := client.DecodeIncoming(b); err == nil {
		client.OnIncoming(client, client.session, incoming)
	} else {
		log.Println("OnText error while processing incoming message", err)
	}
}

func (client *client) Reply(iid string, m interface{}) {
	outgoing := &DataOutgoing{From: client.session.Id, Iid: iid, Data: m}
	if b, err := client.EncodeOutgoing(outgoing); err == nil {
		client.Send(b)
		b.Decref()
	}
}

func (client *client) Session() *Session {
	return client.session
}

func (client *client) ReplaceAndClose() {
	client.session.Close()
	if client.Connection != nil {
		client.Connection.Close()
	}
}
