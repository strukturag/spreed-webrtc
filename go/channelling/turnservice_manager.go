/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2016 struktur AG
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
	"log"
	"sync"
	"time"

	"github.com/strukturag/spreed-turnservicecli/turnservicecli"
)

type TURNServiceManager interface {
	TurnDataCreator
}

type turnServiceManager struct {
	sync.Mutex
	pleaders map[uint64]Sender // Mapping of clients waiting to receive TURN data.

	uri         string
	accessToken string
	clientID    string
	turnService *turnservicecli.TURNService
}

func NewTURNServiceManager(uri string, accessToken string, clientID string) TURNServiceManager {
	turnService := turnservicecli.NewTURNService(uri, 0, nil)
	mgr := &turnServiceManager{
		uri:         uri,
		accessToken: accessToken,
		clientID:    clientID,

		turnService: turnService,
		pleaders:    make(map[uint64]Sender),
	}

	turnService.Open(accessToken, clientID, "")
	turnService.BindOnCredentials(mgr.onCredentials)
	log.Println("Fetching TURN credentials from service")
	go func() {
		//time.Sleep(10000 * time.Millisecond)
		turnService.Autorefresh(true)
	}()
	// Wait a bit, to give TURN service some time to populate credentials, so
	// we avoid to have send them as an update for fast reconnecting clients.
	time.Sleep(500 * time.Millisecond)
	if mgr.turnService.Credentials(false) == nil {
		log.Println("No TURN credentials from service on startup - extra traffic for clients connecting before credentials have been received")
	}

	return mgr
}

func (mgr *turnServiceManager) CreateTurnData(sender Sender, session *Session) *DataTurn {
	credentials := mgr.turnService.Credentials(false)
	turn, err := mgr.turnData(credentials)
	if err != nil || turn.Ttl == 0 {
		// When no data was return from service, refresh quickly.
		mgr.Lock()
		mgr.pleaders[sender.Index()] = sender
		mgr.Unlock()

		// Have client come back early.
		turn.Ttl = 300
	}

	return turn
}

func (mgr *turnServiceManager) turnData(credentials *turnservicecli.CachedCredentialsData) (*DataTurn, error) {
	turn := &DataTurn{}
	if credentials != nil {
		ttl := credentials.TTL()
		if ttl > 0 {
			turn.Username = credentials.Turn.Username
			turn.Password = credentials.Turn.Password
			turn.Servers = credentials.Turn.Servers
			turn.Ttl = int(ttl)
			turn.GeoURI = credentials.Turn.GeoURI

			if len(turn.Servers) > 0 {
				// For backwards compatibility with clients which do not
				// understand turn.Servers, directly deliver the TURN
				// server zone URNs with the lowest priority.
				minPrio := 0
				minPrioIdx := -1
				for idx, server := range turn.Servers {
					if minPrioIdx == -1 || server.Prio < minPrio {
						minPrio = server.Prio
						minPrioIdx = idx
					}
				}
				turn.Urls = turn.Servers[minPrioIdx].URNs
			}
		}
	}

	return turn, nil
}

func (mgr *turnServiceManager) onCredentials(credentials *turnservicecli.CachedCredentialsData, err error) {
	if err != nil {
		log.Printf("TURN credentials service error: %s\n", err.Error())
		return
	}

	log.Println("Received TURN credentials from service", credentials.Turn.Username)

	mgr.Lock()
	for _, sender := range mgr.pleaders {
		if turn, err := mgr.turnData(credentials); err == nil {
			sender.Outgoing(&DataTurnUpdate{
				Type: "TurnUpdate",
				Turn: turn,
			})
		}
	}
	mgr.pleaders = make(map[uint64]Sender) // Clear.
	mgr.Unlock()
}
