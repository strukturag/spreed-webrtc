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
)

type BufferCache interface {
	Push(buffer *bytes.Buffer)

	Pop() *bytes.Buffer
}

type bufferCache struct {
	buffers     chan *bytes.Buffer
	initialSize int
}

func NewBufferCache(count int, initialSize int) BufferCache {
	return &bufferCache{buffers: make(chan *bytes.Buffer, count), initialSize: initialSize}
}

func (cache *bufferCache) Push(buffer *bytes.Buffer) {
	buffer.Reset()
	select {
	case cache.buffers <- buffer:
		// buffer has been stored for reuse
		break
	default:
		// buffer list full, buffer will be collected
		break
	}
}

func (cache *bufferCache) Pop() *bytes.Buffer {
	var buffer *bytes.Buffer
	select {
	case buffer = <-cache.buffers:
		// reuse existing buffer
		break
	default:
		buffer = bytes.NewBuffer(make([]byte, 0, cache.initialSize))
		break
	}
	return buffer
}
