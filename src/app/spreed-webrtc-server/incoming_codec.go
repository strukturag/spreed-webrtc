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
	"bytes"
	"encoding/json"
	"log"
)

type IncomingDecoder interface {
	DecodeIncoming(Buffer) (*DataIncoming, error)
}

type OutgoingEncoder interface {
	EncodeOutgoing(*DataOutgoing) (Buffer, error)
}

type Codec interface {
	NewBuffer() Buffer
	IncomingDecoder
	OutgoingEncoder
}

type incomingCodec struct {
	buffers BufferCache
}

func NewCodec() Codec {
	return &incomingCodec{NewBufferCache(1024, bytes.MinRead)}
}

func (codec incomingCodec) NewBuffer() Buffer {
	return codec.buffers.New()
}

func (codec incomingCodec) DecodeIncoming(b Buffer) (*DataIncoming, error) {
	incoming := &DataIncoming{}
	return incoming, json.Unmarshal(b.Bytes(), incoming)
}

func (codec incomingCodec) EncodeOutgoing(outgoing *DataOutgoing) (Buffer, error) {
	b := codec.NewBuffer()
	if err := json.NewEncoder(b).Encode(outgoing); err != nil {
		log.Println("Error while encoding JSON", err)
		b.Decref()
		return nil, err
	}
	return b, nil
}
