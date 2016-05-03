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
	"fmt"
	"log"
	"sync"
	"time"
)

const (
	PipelineNamespaceCall = "call"
)

type PipelineManager interface {
	BusManager
	SessionStore
	UserStore
	SessionCreator
	GetPipelineByID(id string) (pipeline *Pipeline, ok bool)
	GetPipeline(namespace string, sender Sender, session *Session, to string) *Pipeline
	FindSinkAndSession(to string) (Sink, *Session)
}

type pipelineManager struct {
	BusManager
	SessionStore
	UserStore
	SessionCreator
	mutex               sync.RWMutex
	pipelineTable       map[string]*Pipeline
	sessionTable        map[string]*Session
	sessionByBusIDTable map[string]*Session
	sessionSinkTable    map[string]Sink
	duration            time.Duration
	defaultSinkID       string
	enabled             bool
}

func NewPipelineManager(busManager BusManager, sessionStore SessionStore, userStore UserStore, sessionCreator SessionCreator) PipelineManager {
	plm := &pipelineManager{
		BusManager:          busManager,
		SessionStore:        sessionStore,
		UserStore:           userStore,
		SessionCreator:      sessionCreator,
		pipelineTable:       make(map[string]*Pipeline),
		sessionTable:        make(map[string]*Session),
		sessionByBusIDTable: make(map[string]*Session),
		sessionSinkTable:    make(map[string]Sink),
		duration:            60 * time.Second,
	}

	return plm
}

func (plm *pipelineManager) Start() {
	plm.enabled = true

	plm.start()

	plm.Subscribe("channelling.session.create", plm.sessionCreate)
	plm.Subscribe("channelling.session.close", plm.sessionClose)
}

func (plm *pipelineManager) cleanup() {
	plm.mutex.Lock()
	for id, pipeline := range plm.pipelineTable {
		if pipeline.Expired() {
			pipeline.Close()
			delete(plm.pipelineTable, id)
		}
	}
	plm.mutex.Unlock()
}

func (plm *pipelineManager) start() {
	c := time.Tick(30 * time.Second)
	go func() {
		for _ = range c {
			plm.cleanup()
		}
	}()
}

func (plm *pipelineManager) sessionCreate(subject, reply string, msg *SessionCreateRequest) {
	log.Println("sessionCreate via NATS", subject, reply, msg)

	if msg.Session == nil || msg.Id == "" {
		return
	}

	var sink Sink

	plm.mutex.Lock()
	session, ok := plm.sessionByBusIDTable[msg.Id]
	if ok {
		// Remove existing session with same ID.
		delete(plm.sessionTable, session.Id)
		sink, _ = plm.sessionSinkTable[session.Id]
		delete(plm.sessionSinkTable, session.Id)
		session.Close()
	}
	session = plm.CreateSession(nil, "")
	plm.sessionByBusIDTable[msg.Id] = session
	plm.sessionTable[session.Id] = session
	if sink == nil {
		sink = plm.CreateSink(msg.Id)
		log.Println("Created NATS sink", msg.Id)
	}
	if reply != "" {
		// Always reply with our sink data
		plm.Publish(reply, sink.Export())
	}
	plm.sessionSinkTable[session.Id] = sink

	if msg.SetAsDefault {
		plm.defaultSinkID = session.Id
		log.Println("Using NATS sink as default session", session.Id)
	}
	plm.mutex.Unlock()

	if msg.Session.Status != nil {
		session.Status = msg.Session.Status
	}

	if msg.Session.Userid != "" {
		session.SetUseridFake(msg.Session.Userid)
	}

	if msg.Room != nil {
		room, err := session.JoinRoom(msg.Room.Name, msg.Room.Type, msg.Room.Credentials, nil)
		log.Println("Joined NATS session to room", room, err)
	}

	session.BroadcastStatus()
}

func (plm *pipelineManager) sessionClose(subject, reply string, id string) {
	log.Println("sessionClose via NATS", subject, reply, id)

	if id == "" {
		return
	}

	plm.mutex.Lock()
	session, ok := plm.sessionByBusIDTable[id]
	if ok {
		delete(plm.sessionByBusIDTable, id)
		delete(plm.sessionTable, session.Id)
		if sink, ok := plm.sessionSinkTable[session.Id]; ok {
			delete(plm.sessionSinkTable, session.Id)
			sink.Close()
		}
	}
	plm.mutex.Unlock()

	if ok {
		session.Close()
	}
}

func (plm *pipelineManager) GetPipelineByID(id string) (*Pipeline, bool) {
	plm.mutex.RLock()
	pipeline, ok := plm.pipelineTable[id]
	plm.mutex.RUnlock()
	return pipeline, ok
}

func (plm *pipelineManager) PipelineID(namespace string, sender Sender, session *Session, to string) string {
	return fmt.Sprintf("%s.%s.%s", namespace, session.Id, to)
}

func (plm *pipelineManager) GetPipeline(namespace string, sender Sender, session *Session, to string) *Pipeline {
	if !plm.enabled {
		return nil
	}

	id := plm.PipelineID(namespace, sender, session, to)

	plm.mutex.Lock()
	pipeline, ok := plm.pipelineTable[id]
	if ok {
		// Refresh. We do not care if the pipeline is expired.
		pipeline.Refresh(plm.duration)
		plm.mutex.Unlock()
		return pipeline
	}

	log.Println("Creating pipeline", namespace, id)
	pipeline = NewPipeline(plm, namespace, id, session, plm.duration)
	plm.pipelineTable[id] = pipeline
	plm.mutex.Unlock()

	return pipeline
}

func (plm *pipelineManager) FindSinkAndSession(to string) (sink Sink, session *Session) {
	plm.mutex.RLock()

	var found bool
	if sink, found = plm.sessionSinkTable[to]; found {
		session, _ = plm.sessionTable[to]
		plm.mutex.RUnlock()
		if sink.Enabled() {
			log.Println("Pipeline sink found via manager", sink)
			return sink, session
		}
	} else {
		plm.mutex.RUnlock()
	}

	if plm.defaultSinkID != "" && to != plm.defaultSinkID {
		// Keep target to while returning a the default sink.
		log.Println("Find sink via default sink ID", plm.defaultSinkID)
		sink, _ = plm.FindSinkAndSession(plm.defaultSinkID)
		if sink != nil {
			if session, found = plm.GetSession(to); found {
				return
			}
		}
	}

	return nil, nil
}
