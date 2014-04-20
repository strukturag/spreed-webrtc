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
	"bytes"
	"container/list"
	"github.com/gorilla/websocket"
	"io"
	"log"
	"sync"
	"time"
)

const (

	// Time allowed to write a message to the client.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to client with this period. Must be less than readWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from client.
	maxMessageSize = 1024 * 1024

	// Size of send queue.
	queueSize    = 512
	maxQueueSize = queueSize * 4

	// Throttle.
	maxRatePerSecond = 20
)

type Connection struct {
	// References.
	h  *Hub
	ws *websocket.Conn

	// Data handling.
	condition *sync.Cond
	queue     list.List
	mutex     sync.Mutex
	isClosed  bool

	// Metadata.
	Id           string
	Roomid       string // Keep Roomid here for quick acess without locking c.Session.
	Idx          uint64
	Session      *Session
	IsRegistered bool
	Hello        bool
	Version      string
	RemoteAddr   string
}

func NewConnection(h *Hub, ws *websocket.Conn, remoteAddr string) *Connection {

	c := &Connection{
		h:          h,
		ws:         ws,
		RemoteAddr: remoteAddr,
	}
	c.condition = sync.NewCond(&c.mutex)

	return c

}

func (c *Connection) close() {

	if !c.isClosed {
		c.ws.Close()
		c.mutex.Lock()
		c.Session = nil
		c.isClosed = true
		for {
			head := c.queue.Front()
			if head == nil {
				break
			}
			c.queue.Remove(head)
			message := head.Value.(Buffer)
			message.Decref()
		}
		c.condition.Signal()
		c.mutex.Unlock()
	}

}

func (c *Connection) register() error {

	id, err := c.h.EncodeTicket("id", "")
	if err != nil {
		log.Println("Failed to create new Id while register", err)
		return err
	}
	c.Id = id
	//log.Println("Created new id", id)
	c.h.registerHandler(c)
	return nil
}

func (c *Connection) reregister(token string) error {

	if id, err := c.h.DecodeTicket("token", token); err == nil {
		c.Id = id
		c.h.registerHandler(c)
	} else {
		log.Println("Error while decoding token", err)
		c.register()
	}
	return nil

}

func (c *Connection) unregister() {
	c.h.unregisterHandler(c)
}

func (c *Connection) readAll(dest Buffer, r io.Reader) error {
	var err error
	defer func() {
		e := recover()
		if e == nil {
			return
		}
		if panicErr, ok := e.(error); ok && panicErr == bytes.ErrTooLarge {
			err = panicErr
		} else {
			panic(e)
		}
	}()

	_, err = dest.ReadFrom(r)
	return err
}

// readPump pumps messages from the websocket connection to the hub.
func (c *Connection) readPump() {
	c.ws.SetReadLimit(maxMessageSize)
	c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error {
		c.ws.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	times := list.New()
	for {
		//fmt.Println("readPump wait nextReader", c.Idx)
		op, r, err := c.ws.NextReader()
		if err != nil {
			if err == io.EOF {
			} else {
				log.Println("Error while reading", c.Idx, err)
			}
			break
		}
		switch op {
		case websocket.TextMessage:
			message := c.h.buffers.New()
			err = c.readAll(message, r)
			if err != nil {
				message.Decref()
				break
			}
			now := time.Now()
			if times.Len() == maxRatePerSecond {
				front := times.Front()
				times.Remove(front)
				delta := time.Second - now.Sub(front.Value.(time.Time))
				if delta > 0 {
					// client is sending messages too fast, delay him
					time.Sleep(delta)
				}
			}
			times.PushBack(now)
			c.h.server.OnText(c, message)
			message.Decref()
		}
	}

	c.unregister()
	c.ws.Close()
}

// Write message to outbound queue.
func (c *Connection) send(message Buffer) {

	c.mutex.Lock()
	defer c.mutex.Unlock()
	if c.isClosed {
		return
	}
	//fmt.Println("Outbound queue size", c.Idx, len(c.queue))
	if c.queue.Len() >= maxQueueSize {
		log.Println("Outbound queue overflow", c.Idx, c.queue.Len())
		return
	}
	message.Incref()
	c.queue.PushBack(message)
	c.condition.Signal()

}

// writePump pumps messages from the queue to the websocket connection.
func (c *Connection) writePump() {

	var timer *time.Timer
	ping := false

	// Spawn a timer to emit websocket pings.
	timer = time.AfterFunc(pingPeriod, func() {
		c.mutex.Lock()
		if c.isClosed {
			c.mutex.Unlock()
			return
		}
		ping = true
		c.condition.Signal()
		c.mutex.Unlock()
		timer.Reset(pingPeriod)
	})

	// Wait for actions.
	for {

		c.mutex.Lock()
		// Wait until something todo.
		for !ping && !c.isClosed && c.queue.Len() == 0 {
			// Wait on signal (this also unlocks while waiting, and locks again when got the signal).
			c.condition.Wait()
		}
		// Fast exit if in closed state.
		if c.isClosed {
			c.mutex.Unlock()
			goto cleanup
		}
		// Flush queue if something.
		for {
			head := c.queue.Front()
			if head == nil {
				break
			}
			c.queue.Remove(head)
			message := head.Value.(Buffer)
			if ping {
				// Send ping.
				ping = false
				c.mutex.Unlock()
				if err := c.ping(); err != nil {
					log.Println("Error while sending ping", c.Idx, err)
					message.Decref()
					goto cleanup
				}
			} else {
				c.mutex.Unlock()
			}
			if err := c.write(websocket.TextMessage, message.Bytes()); err != nil {
				log.Println("Error while writing", c.Idx, err)
				message.Decref()
				goto cleanup
			}
			message.Decref()
			c.mutex.Lock()
		}
		if ping {
			// Send ping.
			ping = false
			c.mutex.Unlock()
			if err := c.ping(); err != nil {
				log.Println("Error while sending ping", c.Idx, err)
				goto cleanup
			}
		} else {
			// Final unlock.
			c.mutex.Unlock()
		}

	}

cleanup:
	//fmt.Println("writePump done")
	timer.Stop()
	c.ws.Close()
}

// Write ping message.
func (c *Connection) ping() error {
	return c.write(websocket.PingMessage, []byte{})
}

// Write writes a message with the given opCode and payload.
func (c *Connection) write(opCode int, payload []byte) error {
	c.ws.SetWriteDeadline(time.Now().Add(writeWait))
	return c.ws.WriteMessage(opCode, payload)
}
