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

package buffercache

import (
	"bytes"
	"io"
	"runtime"
	"sync/atomic"
)

type Buffer interface {
	// bytes.Buffer
	Reset()
	Bytes() []byte
	ReadFrom(r io.Reader) (n int64, err error)
	// io.Writer
	Write(p []byte) (n int, err error)
	// provide direct access
	GetBuffer() *bytes.Buffer
	// refcounting
	Incref()
	Decref()
}

type BufferCache interface {
	New() Buffer

	Wrap(data []byte) Buffer
}

type cachedBuffer struct {
	bytes.Buffer
	refcnt int32
	cache  *bufferCache
}

func (b *cachedBuffer) GetBuffer() *bytes.Buffer {
	return &b.Buffer
}

func (b *cachedBuffer) Incref() {
	atomic.AddInt32(&b.refcnt, 1)
}

func (b *cachedBuffer) Decref() {
	if atomic.AddInt32(&b.refcnt, -1) == 0 {
		b.cache.push(b)
	}
}

type directBuffer struct {
	buf    *bytes.Buffer
	refcnt int32
	cache  *bufferCache
}

func (b *directBuffer) Reset() {
	b.buf.Reset()
}

func (b *directBuffer) Bytes() []byte {
	return b.buf.Bytes()
}

func (b *directBuffer) ReadFrom(r io.Reader) (n int64, err error) {
	return b.buf.ReadFrom(r)
}

func (b *directBuffer) Write(p []byte) (n int, err error) {
	return b.buf.Write(p)
}

func (b *directBuffer) GetBuffer() *bytes.Buffer {
	return b.buf
}

func (b *directBuffer) Incref() {
	atomic.AddInt32(&b.refcnt, 1)
}

func (b *directBuffer) Decref() {
	if atomic.AddInt32(&b.refcnt, -1) == 0 {
		b.cache.push(b)
	}
}

type bufferCache struct {
	buffers     []chan Buffer
	initialSize int
	num         int32
	readPos     int32
	writePos    int32
}

func NewBufferCache(count int, initialSize int) BufferCache {
	result := &bufferCache{initialSize: initialSize}
	result.num = int32(runtime.NumCPU())
	result.buffers = make([]chan Buffer, result.num, result.num)
	for i := int32(0); i < result.num; i++ {
		result.buffers[i] = make(chan Buffer, count/runtime.NumCPU())
	}
	result.readPos = 0
	result.writePos = result.num / 2
	return result
}

func (cache *bufferCache) push(buffer Buffer) {
	if buffer, ok := buffer.(*directBuffer); ok {
		buffer.Reset()
		return
	}
	buffer.Reset()
	pos := atomic.AddInt32(&cache.writePos, 1) % cache.num
	select {
	case cache.buffers[pos] <- buffer:
		// buffer has been stored for reuse
		break
	default:
		// buffer list full, buffer will be collected
		break
	}
}

func (cache *bufferCache) New() Buffer {
	var buffer Buffer
	pos := atomic.AddInt32(&cache.readPos, 1) % cache.num
	select {
	case buffer = <-cache.buffers[pos]:
		// reuse existing buffer
		buffer.Incref()
		break
	default:
		buffer = &cachedBuffer{refcnt: 1, cache: cache}
		buffer.GetBuffer().Grow(cache.initialSize)
		break
	}
	return buffer
}

func (cache *bufferCache) Wrap(data []byte) Buffer {
	return &directBuffer{refcnt: 1, cache: cache, buf: bytes.NewBuffer(data)}
}

func ReadAll(dest Buffer, r io.Reader) error {
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
