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
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/nats-io/nats"
	"github.com/strukturag/spreed-webrtc/go/natsconnection"
)

const (
	BusManagerStartup    = "startup"
	BusManagerOffer      = "offer"
	BusManagerAnswer     = "answer"
	BusManagerBye        = "bye"
	BusManagerConnect    = "connect"
	BusManagerDisconnect = "disconnect"
	BusManagerSession    = "session"
)

// A BusManager provides the API to interact with a bus.
type BusManager interface {
	Publish(subject string, v interface{}) error
	Request(subject string, v interface{}, vPtr interface{}, timeout time.Duration) error
	Trigger(name, from, payload string, data interface{}, pipeline *Pipeline) error
	Subscribe(subject string, cb nats.Handler) (*nats.Subscription, error)
}

// A BusTrigger is a container to serialize trigger events
// for the bus backend.
type BusTrigger struct {
	Id       string
	Name     string
	From     string
	Payload  string      `json:",omitempty"`
	Data     interface{} `json:",omitempty"`
	Pipeline string      `json:",omitempty"`
}

// BusSubjectTrigger returns the bus subject for trigger payloads.
func BusSubjectTrigger(prefix, suffix string) string {
	return fmt.Sprintf("%s.%s", prefix, suffix)
}

type busManager struct {
	BusManager
}

// NewBusManager creates and initializes a new BusMager with the
// provided flags for NATS support. It is intended to connect the
// backend bus with a easy to use API to send and receive bus data.
func NewBusManager(id string, useNats bool, subjectPrefix string) BusManager {
	var b BusManager
	var err error
	if useNats {
		b, err = newNatsBus(id, subjectPrefix)
		if err == nil {
			log.Println("NATS bus connected")
		} else {
			log.Println("Error connecting NATS bus", err)
			b = &noopBus{id}
		}
	} else {
		b = &noopBus{id}
	}
	if err == nil {
		b.Trigger(BusManagerStartup, id, "", nil, nil)
	}

	return &busManager{b}
}

type noopBus struct {
	id string
}

func (bus *noopBus) Publish(subject string, v interface{}) error {
	return nil
}

func (bus *noopBus) Request(subject string, v interface{}, vPtr interface{}, timeout time.Duration) error {
	return nil
}

func (bus *noopBus) Trigger(name, from, payload string, data interface{}, pipeline *Pipeline) error {
	return nil
}

func (bus *noopBus) Subscribe(subject string, cb nats.Handler) (*nats.Subscription, error) {
	return nil, nil
}

type natsBus struct {
	id           string
	prefix       string
	ec           *natsconnection.EncodedConnection
	triggerQueue chan *busQueueEntry
}

func newNatsBus(id, prefix string) (*natsBus, error) {
	ec, err := natsconnection.EstablishJSONEncodedConnection(nil)
	if err != nil {
		return nil, err
	}
	if prefix == "" {
		prefix = "channelling.trigger"
	}
	// Create buffered channel for outbound NATS data.
	triggerQueue := make(chan *busQueueEntry, 50)
	// Start go routine to process outbount NATS publishing.
	go chPublish(ec, triggerQueue)

	return &natsBus{id, prefix, ec, triggerQueue}, nil
}

func (bus *natsBus) Publish(subject string, v interface{}) error {
	return bus.ec.Publish(subject, v)
}

func (bus *natsBus) Request(subject string, v interface{}, vPtr interface{}, timeout time.Duration) error {
	return bus.ec.Request(subject, v, vPtr, timeout)
}

func (bus *natsBus) Trigger(name, from, payload string, data interface{}, pipeline *Pipeline) (err error) {
	trigger := &BusTrigger{
		Id:      bus.id,
		Name:    name,
		From:    from,
		Payload: payload,
		Data:    data,
	}
	if pipeline != nil {
		trigger.Pipeline = pipeline.GetID()
	}
	entry := &busQueueEntry{BusSubjectTrigger(bus.prefix, name), trigger}
	select {
	case bus.triggerQueue <- entry:
		// sent ok
	default:
		log.Println("Failed to queue NATS event - queue full?")
		err = errors.New("NATS trigger queue full")
	}

	return err
}

func (bus *natsBus) Subscribe(subject string, cb nats.Handler) (*nats.Subscription, error) {
	return bus.ec.Subscribe(subject, cb)
}

type busQueueEntry struct {
	subject string
	data    interface{}
}

func chPublish(ec *natsconnection.EncodedConnection, channel chan (*busQueueEntry)) {
	for {
		entry := <-channel
		err := ec.Publish(entry.subject, entry.data)
		if err != nil {
			log.Println("Failed to publish to NATS", entry.subject, err)
		}
	}
}
