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
	"log"
)

type Sender interface {
	Send(Buffer)
}

type Client interface {
	Sender
	Session() *Session
	Index() uint64
	Close()
	ReplaceAndClose(Client)
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
	if reply, err := client.ChannellingAPI.OnConnect(client, client.session); err == nil {
		client.reply("", reply)
	} else {
		log.Println("OnConnect error", err)
	}
}

func (client *client) OnDisconnect() {
	client.session.Close()
	client.ChannellingAPI.OnDisconnect(client, client.session)
}

func (client *client) OnText(b Buffer) {
	incoming, err := client.DecodeIncoming(b)
	if err != nil {
		log.Println("OnText error while processing incoming message", err)
		return
	}

	if reply, err := client.OnIncoming(client, client.session, incoming); err != nil {
		client.reply(incoming.Iid, err)
	} else if reply != nil {
		client.reply(incoming.Iid, reply)
	}
}

func (client *client) reply(iid string, m interface{}) {
	outgoing := &DataOutgoing{From: client.session.Id, Iid: iid, Data: m}
	if b, err := client.EncodeOutgoing(outgoing); err == nil {
		client.Send(b)
		b.Decref()
	}
}

func (client *client) Session() *Session {
	return client.session
}

func (client *client) ReplaceAndClose(oldClient Client) {
	oldSession := oldClient.Session()
	client.session.Replace(oldSession)
	go func() {
		// Close old session and client in another go routine,
		// to avoid blocking the new client if the old one hangs or
		// whatever.
		log.Printf("Closing obsolete client %d (replaced with %d) with id %s\n", oldClient.Index(), client.Index(), oldSession.Id)
		oldSession.Close()
		oldClient.Close()
	}()
}
