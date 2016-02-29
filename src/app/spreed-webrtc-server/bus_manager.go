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
	"fmt"
	"log"

	"github.com/nats-io/nats"
)

const (
	BusManagerOffer      = "offer"
	BusManagerAnswer     = "answer"
	BusManagerBye        = "bye"
	BusManagerConnect    = "connect"
	BusManagerDisconnect = "disconnect"
	BusManagerAuth       = "auth"
)

type BusManager interface {
	Trigger(name, from, payload string, data interface{}) error
}

type BusEvent struct {
	Name    string
	From    string
	Payload string      `json:",omitempty"`
	Data    interface{} `json:",omitempty"`
}

type busManager struct {
	BusManager
}

func NewBusManager(useNats bool, subjectPrefix string) BusManager {
	var b BusManager
	if useNats {
		var err error
		b, err = newNatsBus(subjectPrefix)
		if err == nil {
			log.Println("Nats bus connected")
		} else {
			log.Println("Error connecting nats bus", err)
			b = &noopBus{}
		}
	} else {
		b = &noopBus{}
	}
	return &busManager{b}
}

type noopBus struct {
}

func (bus *noopBus) Trigger(name, from, payload string, data interface{}) error {
	return nil
}

type natsBus struct {
	prefix string
	ec     *nats.EncodedConn
}

func newNatsBus(prefix string) (*natsBus, error) {
	ec, err := EstablishNatsConnection(nil)
	if err != nil {
		return nil, err
	}
	if prefix == "" {
		prefix = "channelling.trigger"
	}
	return &natsBus{prefix, ec}, nil
}

func (bus *natsBus) Trigger(name, from, payload string, data interface{}) (err error) {
	if bus.ec != nil {
		event := &BusEvent{
			Name:    name,
			From:    from,
			Payload: payload,
			Data:    data,
		}
		err = bus.ec.Publish(fmt.Sprintf("%s.%s", bus.prefix, name), event)
		if err != nil {
			log.Println("Failed to trigger NATS event", err)
		}
	}
	return err
}
