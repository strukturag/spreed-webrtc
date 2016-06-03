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

package server

import (
	"net/http"
	"runtime"
	"time"

	"github.com/strukturag/spreed-webrtc/go/channelling"
)

type Stat struct {
	details bool
	Runtime *RuntimeStat         `json:"runtime"`
	Hub     *channelling.HubStat `json:"hub"`
}

func NewStat(details bool, statsGenerator channelling.StatsGenerator) *Stat {
	stat := &Stat{
		details: details,
		Runtime: &RuntimeStat{},
		Hub:     statsGenerator.Stat(details),
	}
	stat.Runtime.Read()
	return stat
}

type RuntimeStat struct {
	Goroutines uint64 `json:"goroutines"`
	Alloc      uint64 `json:"alloc"`
	Mallocs    uint64 `json:"mallocs"`
	Frees      uint64 `json:"frees"`
	Pauses     uint64 `json:"pauses"`
	Heap       uint64 `json:"heap"`
	Stack      uint64 `json:"stack"`
}

func (stat *RuntimeStat) Read() {

	memStats := &runtime.MemStats{}
	runtime.ReadMemStats(memStats)

	stat.Goroutines = uint64(runtime.NumGoroutine())
	stat.Alloc = uint64(memStats.Alloc)
	stat.Mallocs = uint64(memStats.Mallocs)
	stat.Frees = uint64(memStats.Frees)
	stat.Pauses = uint64(memStats.PauseTotalNs) / uint64(time.Millisecond)
	stat.Heap = uint64(memStats.HeapAlloc)
	stat.Stack = uint64(memStats.StackInuse)

}

type Stats struct {
	channelling.StatsGenerator
}

func (stats *Stats) Get(request *http.Request) (int, interface{}, http.Header) {

	details := request.Form.Get("details") == "1"
	return 200, NewStat(details, stats), http.Header{"Content-Type": {"application/json; charset=utf-8"}, "Access-Control-Allow-Origin": {"*"}}

}
