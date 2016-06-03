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
	"crypto/aes"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"github.com/gorilla/securecookie"
	"log"
	"sync"
	"time"
)

const (
	turnTTL = 3600 // XXX(longsleep): Add to config file.
)

type Hub interface {
	ClientStats
	Unicaster
	TurnDataCreator
	ContactManager
}

type hub struct {
	OutgoingEncoder
	clients    map[string]*Client
	config     *Config
	turnSecret []byte
	mutex      sync.RWMutex
	contacts   *securecookie.SecureCookie
}

func NewHub(config *Config, sessionSecret, encryptionSecret, turnSecret []byte, encoder OutgoingEncoder) Hub {
	h := &hub{
		OutgoingEncoder: encoder,
		clients:         make(map[string]*Client),
		config:          config,
		turnSecret:      turnSecret,
	}

	h.contacts = securecookie.New(sessionSecret, encryptionSecret)
	h.contacts.MaxAge(0) // Forever
	h.contacts.HashFunc(sha256.New)
	h.contacts.BlockFunc(aes.NewCipher)

	return h
}

func (h *hub) ClientInfo(details bool) (clientCount int, sessions map[string]*DataSession, connections map[string]string) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	clientCount = len(h.clients)
	if details {
		sessions = make(map[string]*DataSession)
		for id, client := range h.clients {
			sessions[id] = client.Session().Data()
		}

		connections = make(map[string]string)
		for id, client := range h.clients {
			connections[fmt.Sprintf("%d", client.Index())] = id
		}
	}

	return
}

func (h *hub) CreateTurnData(session *Session) *DataTurn {
	// Create turn data credentials for shared secret auth with TURN
	// server. See http://tools.ietf.org/html/draft-uberti-behave-turn-rest-00
	// and https://code.google.com/p/rfc5766-turn-server/ REST API auth
	// and set shared secret in TURN server with static-auth-secret.
	if len(h.turnSecret) == 0 {
		return &DataTurn{}
	}
	id := session.Id
	bar := sha256.New()
	bar.Write([]byte(id))
	id = base64.StdEncoding.EncodeToString(bar.Sum(nil))
	foo := hmac.New(sha1.New, h.turnSecret)
	expiration := int32(time.Now().Unix()) + turnTTL
	user := fmt.Sprintf("%d:%s", expiration, id)
	foo.Write([]byte(user))
	password := base64.StdEncoding.EncodeToString(foo.Sum(nil))

	return &DataTurn{user, password, turnTTL, h.config.TurnURIs}
}

func (h *hub) GetSession(id string) (session *Session, ok bool) {
	var client *Client
	client, ok = h.GetClient(id)
	if ok {
		session = client.Session()
	}

	return
}

func (h *hub) OnConnect(client *Client, session *Session) {
	h.mutex.Lock()
	log.Printf("Created client %d with id %s\n", client.Index(), session.Id)
	// Register connection or replace existing one.
	if ec, ok := h.clients[session.Id]; ok {
		// Clean up old client at the end outside the hub lock.
		defer client.ReplaceAndClose(ec)
	}
	h.clients[session.Id] = client
	h.mutex.Unlock()
}

func (h *hub) OnDisconnect(client *Client, session *Session) {
	h.mutex.Lock()
	if ec, ok := h.clients[session.Id]; ok {
		if ec == client {
			log.Printf("Cleaning up client %d for session id %s\n", ec.Index(), session.Id)
			delete(h.clients, session.Id)
		} else {
			log.Printf("Not cleaning up session %s as client %d was replaced with %d\n", session.Id, client.Index(), ec.Index())
		}
	}
	h.mutex.Unlock()
}

func (h *hub) GetClient(sessionID string) (client *Client, ok bool) {
	h.mutex.RLock()
	client, ok = h.clients[sessionID]
	h.mutex.RUnlock()

	return
}

func (h *hub) Unicast(to string, outgoing *DataOutgoing, pipeline *Pipeline) {
	client, ok := h.GetClient(to)
	if pipeline != nil {
		if complete := pipeline.FlushOutgoing(h, client, to, outgoing); complete {
			return
		}
	}
	if !ok {
		log.Println("Unicast To not found", to)
		return
	}
	if message, err := h.EncodeOutgoing(outgoing); err == nil {
		client.Send(message)
		message.Decref()
	}
}

func (h *hub) GetContactID(session *Session, token string) (userid string, err error) {
	contact := &Contact{}
	err = h.contacts.Decode("contact", token, contact)
	if err != nil {
		err = fmt.Errorf("Failed to decode incoming contact token", err, token)
		return
	}
	// Use the userid which is not ours from the contact data.
	suserid := session.Userid()
	if contact.A == suserid {
		userid = contact.B
	} else if contact.B == suserid {
		userid = contact.A
	}
	if userid == "" {
		err = fmt.Errorf("Ignoring foreign contact token", contact.A, contact.B)
	}

	return
}

func (h *hub) ContactrequestHandler(session *Session, to string, cr *DataContactRequest) error {
	var err error

	if cr.Success {
		// Client replied with success.
		// Decode Token and make sure c.Session.Userid and the to Session.Userid are a match.
		contact := &Contact{}
		err = h.contacts.Decode("contact", cr.Token, contact)
		if err != nil {
			return err
		}
		suserid := session.Userid()
		if suserid == "" {
			return errors.New("no userid")
		}
		session, ok := h.GetSession(to)
		if !ok {
			return errors.New("unknown to session for confirm")
		}
		userid := session.Userid()
		if userid == "" {
			return errors.New("to has no userid for confirm")
		}
		if suserid != contact.A {
			return errors.New("contact mismatch in a")
		}
		if userid != contact.B {
			return errors.New("contact mismatch in b")
		}
	} else {
		if cr.Token != "" {
			// Client replied with no success.
			// Remove token.
			cr.Token = ""
		} else {
			// New request.
			// Create Token with flag and c.Session.Userid and the to Session.Userid.
			suserid := session.Userid()
			if suserid == "" {
				return errors.New("no userid")
			}
			session, ok := h.GetSession(to)
			if !ok {
				return errors.New("unknown to session")
			}
			userid := session.Userid()
			if userid == "" {
				return errors.New("to has no userid")
			}
			if userid == suserid {
				return errors.New("to userid cannot be the same as own userid")
			}
			// Create object.
			contact := &Contact{userid, suserid}
			// Serialize.
			cr.Token, err = h.contacts.Encode("contact", contact)
		}
	}

	return err
}
