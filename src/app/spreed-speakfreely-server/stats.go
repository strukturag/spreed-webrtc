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
	"net/http"
	"runtime"
	"time"
)

type Stat struct {
	details bool
	Runtime *RuntimeStat `json:"runtime"`
	Hub     *HubStat     `json:"hub"`
}

func NewStat(details bool, h *Hub) *Stat {
	stat := &Stat{
		details: details,
		Runtime: &RuntimeStat{},
		Hub:     h.Stat(details),
	}
	stat.Runtime.Read()
	return stat
}

type RuntimeStat struct {
	Goroutines float64 `json:"goroutines"`
	Alloc      float64 `json:"alloc"`
	Mallocs    float64 `json:"mallocs"`
	Frees      float64 `json:"frees"`
	Pauses     float64 `json:"pauses"`
	Heap       float64 `json:"heap"`
	Stack      float64 `json:"stack"`
}

func (stat *RuntimeStat) Read() {

	memStats := &runtime.MemStats{}
	runtime.ReadMemStats(memStats)

	stat.Goroutines = float64(runtime.NumGoroutine())
	stat.Alloc = float64(memStats.Alloc)
	stat.Mallocs = float64(memStats.Mallocs)
	stat.Frees = float64(memStats.Frees)
	stat.Pauses = float64(memStats.PauseTotalNs) / float64(time.Millisecond)
	stat.Heap = float64(memStats.HeapAlloc)
	stat.Stack = float64(memStats.StackInuse)

}

type Stats struct {
	hub *Hub
}

func (stats *Stats) Get(r *http.Request) (int, interface{}) {

	r.ParseForm()
	details := r.FormValue("details") == "1"

	stat := NewStat(details, stats.hub)
	return 200, stat

}
