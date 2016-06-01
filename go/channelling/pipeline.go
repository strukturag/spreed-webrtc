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
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/strukturag/spreed-webrtc/go/buffercache"
)

type PipelineFeedLine struct {
	Seq int
	Msg *DataOutgoing
}

type Pipeline struct {
	PipelineManager PipelineManager
	mutex           sync.RWMutex
	namespace       string
	id              string
	from            *Session
	to              *Session
	expires         *time.Time
	data            []*DataSinkOutgoing
	sink            Sink
	recvQueue       chan *DataIncoming
	closed          bool
}

func NewPipeline(manager PipelineManager,
	namespace string,
	id string,
	from *Session,
	duration time.Duration) *Pipeline {
	pipeline := &Pipeline{
		PipelineManager: manager,
		namespace:       namespace,
		id:              id,
		from:            from,
		recvQueue:       make(chan *DataIncoming, 100),
	}
	go pipeline.receive()
	pipeline.Refresh(duration)
	return pipeline
}

func (pipeline *Pipeline) receive() {
	// TODO(longsleep): Call to ToSession() should be avoided because it locks.
	api := pipeline.PipelineManager.GetChannellingAPI()
	for data := range pipeline.recvQueue {
		session := pipeline.ToSession()
		reply, err := api.OnIncoming(nil, session, data)
		if err != nil {
			// TODO(longsleep): Handle reply and error.
			log.Println("Pipeline receive incoming error", err)
		}
		api.OnIncomingProcessed(nil, session, data, reply, err)
	}
	log.Println("Pipeline receive done")
}

func (pipeline *Pipeline) GetID() string {
	return pipeline.id
}

func (pipeline *Pipeline) Refresh(duration time.Duration) {
	pipeline.mutex.Lock()
	pipeline.refresh(duration)
	pipeline.mutex.Unlock()
}

func (pipeline *Pipeline) refresh(duration time.Duration) {
	expiration := time.Now().Add(duration)
	pipeline.expires = &expiration
}

func (pipeline *Pipeline) Add(msg *DataSinkOutgoing) *Pipeline {
	msg.Pipe = pipeline.id
	pipeline.mutex.Lock()
	pipeline.data = append(pipeline.data, msg)
	pipeline.refresh(30 * time.Second)
	pipeline.mutex.Unlock()

	return pipeline
}

func (pipeline *Pipeline) Send(b buffercache.Buffer) {
	// Noop.
}

func (pipeline *Pipeline) Index() uint64 {
	return 0
}

func (pipeline *Pipeline) Close() {
	pipeline.mutex.Lock()
	if !pipeline.closed {
		pipeline.expires = nil
		if pipeline.sink != nil {
			pipeline.sink = nil
		}
		close(pipeline.recvQueue)
		pipeline.closed = true
		log.Println("Closed pipeline")
	}
	pipeline.mutex.Unlock()
}

func (pipeline *Pipeline) Expired() bool {
	var expired bool
	pipeline.mutex.RLock()
	if pipeline.expires == nil {
		expired = true
	} else {
		expired = pipeline.expires.Before(time.Now())
	}
	pipeline.mutex.RUnlock()

	return expired
}

func (pipeline *Pipeline) FromSession() *Session {
	pipeline.mutex.RLock()
	defer pipeline.mutex.RUnlock()
	return pipeline.from
}

func (pipeline *Pipeline) ToSession() *Session {
	pipeline.mutex.RLock()
	defer pipeline.mutex.RUnlock()
	return pipeline.to
}

func (pipeline *Pipeline) JSONFeed(since, limit int) ([]byte, error) {
	pipeline.mutex.RLock()
	var lineRaw []byte
	var line *PipelineFeedLine
	var buffer bytes.Buffer
	var err error
	data := pipeline.data[since:]
	count := 0
	for seq, msg := range data {
		line = &PipelineFeedLine{
			Seq: seq + since,
			Msg: msg.Outgoing,
		}
		lineRaw, err = json.Marshal(line)
		if err != nil {
			return nil, err
		}
		buffer.Write(lineRaw)
		buffer.WriteString("\n")

		count++
		if limit > 0 && count >= limit {
			break
		}
	}
	pipeline.mutex.RUnlock()

	return buffer.Bytes(), nil
}

func (pipeline *Pipeline) FlushOutgoing(hub Hub, client *Client, to string, outgoing *DataOutgoing) bool {
	//log.Println("Flush outgoing via pipeline", to, client == nil)
	if client == nil {
		sinkOutgoing := &DataSinkOutgoing{
			Outgoing: outgoing,
		}

		pipeline.mutex.Lock()
		sink := pipeline.sink
		toSession := pipeline.to
		fromSession := pipeline.from

		for {
			if sink != nil && sink.Enabled() {
				// Sink it.
				pipeline.mutex.Unlock()
				break
			}

			sink, toSession = pipeline.PipelineManager.FindSinkAndSession(to)
			if sink != nil {
				pipeline.to = toSession
				err := pipeline.attach(sink)
				if err == nil {
					pipeline.mutex.Unlock()

					// Create incoming receiver.
					sink.BindRecvChan(pipeline.recvQueue)

					// Sink it.
					break
				}
			}

			// Not pipelined, do nothing.
			pipeline.mutex.Unlock()
			break
		}

		if fromSession != nil {
			sinkOutgoing.FromUserid = fromSession.Userid()
		}
		if toSession != nil {
			sinkOutgoing.ToUserid = toSession.Userid()
		}
		pipeline.Add(sinkOutgoing)

		if sink != nil {
			// Pipelined, sink data.
			sink.Write(sinkOutgoing)
			return true
		}
	}

	return false
}

func (pipeline *Pipeline) Attach(sink Sink) error {
	pipeline.mutex.Lock()
	defer pipeline.mutex.Unlock()

	// Sink existing data first.
	log.Println("Attach sink to pipeline", pipeline.id)
	err := pipeline.attach(sink)
	if err == nil {
		for _, msg := range pipeline.data {
			log.Println("Flushing pipeline to sink after attach", len(pipeline.data))
			sink.Write(msg)
		}
	}

	return err
}

func (pipeline *Pipeline) attach(sink Sink) error {
	if pipeline.sink != nil {
		return errors.New("pipeline already attached to sink")
	}
	pipeline.sink = sink
	return nil
}
