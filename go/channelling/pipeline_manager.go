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
	GetPipelineByID(id string) (pipeline *Pipeline, ok bool)
	GetPipeline(namespace string, sender Sender, session *Session, to string) *Pipeline
}

type pipelineManager struct {
	BusManager
	SessionStore
	UserStore
	mutex     sync.RWMutex
	pipelines map[string]*Pipeline
	duration  time.Duration
}

func NewPipelineManager(busManager BusManager, sessionStore SessionStore, userStore UserStore) PipelineManager {
	plm := &pipelineManager{
		BusManager:   busManager,
		SessionStore: sessionStore,
		UserStore:    userStore,
		pipelines:    make(map[string]*Pipeline),
		duration:     30 * time.Minute,
	}
	plm.start()
	return plm
}

func (plm *pipelineManager) cleanup() {
	plm.mutex.Lock()
	for id, pipeline := range plm.pipelines {
		if pipeline.Expired() {
			pipeline.Close()
			delete(plm.pipelines, id)
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

func (plm *pipelineManager) GetPipelineByID(id string) (*Pipeline, bool) {
	plm.mutex.RLock()
	pipeline, ok := plm.pipelines[id]
	if !ok {
		// XXX(longsleep): Hack for development
		for _, pipeline = range plm.pipelines {
			ok = true
			break
		}
	}
	plm.mutex.RUnlock()
	return pipeline, ok
}

func (plm *pipelineManager) PipelineID(namespace string, sender Sender, session *Session, to string) string {
	return fmt.Sprintf("%s.%s.%s", namespace, session.Id, to)
}

func (plm *pipelineManager) GetPipeline(namespace string, sender Sender, session *Session, to string) *Pipeline {
	id := plm.PipelineID(namespace, sender, session, to)

	plm.mutex.Lock()
	pipeline, ok := plm.pipelines[id]
	if ok {
		// Refresh. We do not care if the pipeline is expired.
		pipeline.Refresh(plm.duration)
		plm.mutex.Unlock()
		return pipeline
	}

	log.Println("Creating pipeline", namespace, id)
	pipeline = NewPipeline(plm, namespace, id, session, plm.duration)
	plm.pipelines[id] = pipeline
	plm.mutex.Unlock()

	return pipeline
}
