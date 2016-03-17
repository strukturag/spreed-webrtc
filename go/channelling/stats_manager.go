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
	"sync/atomic"
)

type HubStat struct {
	Rooms                 int                     `json:"rooms"`
	Connections           int                     `json:"connections"`
	Sessions              int                     `json:"sessions"`
	Users                 int                     `json:"users"`
	Count                 uint64                  `json:"count"`
	BroadcastChatMessages uint64                  `json:"broadcastchatmessages"`
	UnicastChatMessages   uint64                  `json:"unicastchatmessages"`
	IdsInRoom             map[string][]string     `json:"idsinroom,omitempty"`
	SessionsById          map[string]*DataSession `json:"sessionsbyid,omitempty"`
	UsersById             map[string]*DataUser    `json:"usersbyid,omitempty"`
	ConnectionsByIdx      map[string]string       `json:"connectionsbyidx,omitempty"`
}

type ConnectionCounter interface {
	CountConnection() uint64
}

type StatsCounter interface {
	CountBroadcastChat()
	CountUnicastChat()
}

type StatsGenerator interface {
	Stat(details bool) *HubStat
}

type StatsManager interface {
	ConnectionCounter
	StatsCounter
	StatsGenerator
}

type statsManager struct {
	ClientStats
	RoomStats
	UserStats
	connectionCount       uint64
	broadcastChatMessages uint64
	unicastChatMessages   uint64
}

func NewStatsManager(clientStats ClientStats, roomStats RoomStats, userStats UserStats) StatsManager {
	return &statsManager{clientStats, roomStats, userStats, 0, 0, 0}
}

func (stats *statsManager) CountConnection() uint64 {
	return atomic.AddUint64(&stats.connectionCount, 1)
}

func (stats *statsManager) CountBroadcastChat() {
	atomic.AddUint64(&stats.broadcastChatMessages, 1)
}

func (stats *statsManager) CountUnicastChat() {
	atomic.AddUint64(&stats.unicastChatMessages, 1)
}

func (stats *statsManager) Stat(details bool) *HubStat {
	roomCount, roomSessionInfo := stats.RoomInfo(details)
	clientCount, sessions, connections := stats.ClientInfo(details)
	userCount, users := stats.UserInfo(details)

	return &HubStat{
		Rooms:       roomCount,
		Connections: clientCount,
		Sessions:    clientCount,
		Users:       userCount,
		Count:       atomic.LoadUint64(&stats.connectionCount),
		BroadcastChatMessages: atomic.LoadUint64(&stats.broadcastChatMessages),
		UnicastChatMessages:   atomic.LoadUint64(&stats.unicastChatMessages),
		IdsInRoom:             roomSessionInfo,
		SessionsById:          sessions,
		UsersById:             users,
		ConnectionsByIdx:      connections,
	}
}
