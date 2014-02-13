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

import (
	"log"
	"time"
)

const (
	roomMaxWorkers     = 10000
	roomExpiryDuration = 60 * time.Second
)

type RoomWorker struct {
	// References.
	h *Hub

	// Data handling.
	workers chan (func())
	expired chan (bool)
	timer   *time.Timer

	// Metadata.
	Id string
}

func NewRoomWorker(h *Hub, id string) *RoomWorker {

	log.Printf("Creating worker for room '%s'\n", id)

	r := &RoomWorker{
		h:  h,
		Id: id,
	}
	r.workers = make(chan func(), roomMaxWorkers)
	r.expired = make(chan bool)

	// Create expire timer.
	r.timer = time.AfterFunc(roomExpiryDuration, func() {
		log.Printf("Room worker not in use - cleaning up '%s'\n", r.Id)
		r.expired <- true
	})

	return r

}

func (r *RoomWorker) Start() {

	// Main blocking worker.
L:
	for {

		r.timer.Reset(roomExpiryDuration)

		select {
		case <-r.expired:
			//fmt.Println("Work room expired", r.Id)
			break L
		case w := <-r.workers:
			//fmt.Println("Running worker", r.Id, w)
			w()
		}

	}

	r.timer.Stop()
	close(r.workers)
	//fmt.Println("Exit worker", r.Id)

}

func (r *RoomWorker) Run(f func()) bool {

	select {
	case r.workers <- f:
		return true
	default:
		log.Printf("Room worker channel full or closed '%s'\n", r.Id)
		return false
	}

}
