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
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/satori/go.uuid"
	"github.com/strukturag/phoenix"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type UsersHandler interface {
	Validate(snr *SessionNonceRequest) (string, error)
	Create(snr *UserNonce) (*UserNonce, error)
}

type UsersSharedsecretHandler struct {
	secret []byte
}

func (uh *UsersSharedsecretHandler) createHMAC(useridCombo string) string {

	m := hmac.New(sha256.New, uh.secret)
	m.Write([]byte(useridCombo))
	return base64.StdEncoding.EncodeToString(m.Sum(nil))

}

func (uh *UsersSharedsecretHandler) Validate(snr *SessionNonceRequest) (string, error) {

	// Parse UseridCombo.
	useridCombo := strings.SplitN(snr.UseridCombo, ":", 2)
	expirationString, userid := useridCombo[0], useridCombo[1]

	expiration, err := strconv.ParseInt(expirationString, 10, 64)
	if err != nil {
		return "", err
	}

	// Check expiration.
	if time.Unix(expiration, 0).Before(time.Now()) {
		return "", errors.New("expired secret")
	}

	secret := uh.createHMAC(snr.UseridCombo)
	if snr.Secret != secret {
		return "", errors.New("invalid secret")
	}

	return userid, nil

}

func (uh *UsersSharedsecretHandler) Create(un *UserNonce) (*UserNonce, error) {

	// TODO(longsleep): Make this configureable - One year for now ...
	expiration := time.Now().Add(time.Duration(1) * time.Hour * 24 * 31 * 12)
	un.UseridCombo = fmt.Sprintf("%d:%s", expiration.Unix(), un.Userid)
	un.Secret = uh.createHMAC(un.UseridCombo)
	return un, nil

}

type UserNonce struct {
	Nonce       string `json:"nonce"`
	Userid      string `json:"userid"`
	UseridCombo string `json:"useridcombo"`
	Secret      string `json:"secret"`
	Success     bool   `json:"success"`
}

type Users struct {
	hub     *Hub
	Enabled bool
	Create  bool
	Handler UsersHandler
}

func NewUsers(hub *Hub, runtime phoenix.Runtime) *Users {

	enabled := false
	enabledString, err := runtime.GetString("users", "enabled")
	if err == nil {
		enabled = enabledString == "true"
	}

	create := false
	createString, err := runtime.GetString("users", "allowRegistration")
	if err == nil {
		create = createString == "true"
	}

	var handler UsersHandler

	if enabled {

		mode, _ := runtime.GetString("users", "mode")
		switch mode {
		case "sharedsecret":
			secret, _ := runtime.GetString("users", "sharedsecret_secret")
			if secret != "" {
				handler = &UsersSharedsecretHandler{secret: []byte(secret)}
			}
		default:
			mode = ""
		}

		if handler == nil {
			enabled = false
		} else {
			log.Printf("Enabled users handler '%s'\n", mode)
			if create {
				log.Println("Enabled users registration")
			}
		}

	}

	return &Users{
		hub:     hub,
		Enabled: enabled,
		Create:  create,
		Handler: handler,
	}

}

// Post is used to create new userids for this server.
func (users *Users) Post(request *http.Request) (int, interface{}, http.Header) {

	if !users.Create {
		return 404, "404 page not found", http.Header{"Content-Type": {"text/plain"}}
	}

	decoder := json.NewDecoder(request.Body)
	var snr SessionNonceRequest
	err := decoder.Decode(&snr)
	if err != nil {
		return 400, NewApiError("users_bad_request", "Failed to parse request"), http.Header{"Content-Type": {"application/json"}}
	}

	// Make sure that we have a Sid.
	if snr.Sid == "" || snr.Id == "" {
		return 400, NewApiError("users_bad_request", "Incomplete request"), http.Header{"Content-Type": {"application/json"}}
	}

	// Do this before session validation to avoid timing information.
	userid := uuid.NewV4().String()

	// Make sure Sid matches session and is valid.
	if !users.hub.ValidateSession(snr.Id, snr.Sid) {
		return 403, NewApiError("users_invalid_session", "Invalid session"), http.Header{"Content-Type": {"application/json"}}
	}

	nonce, err := users.hub.sessiontokenHandler(&SessionToken{Id: snr.Id, Sid: snr.Sid, Userid: userid})
	if err != nil {
		return 400, NewApiError("users_request_failed", fmt.Sprintf("Error: %q", err)), http.Header{"Content-Type": {"application/json"}}
	}

	un, err := users.Handler.Create(&UserNonce{Nonce: nonce, Userid: userid, Success: true})
	if err != nil {
		return 400, NewApiError("users_create_failed", fmt.Sprintf("Error: %q", err)), http.Header{"Content-Type": {"application/json"}}
	}

	log.Printf("Users create successfull %s -> %s\n", snr.Id, un.Userid)
	return 200, un, http.Header{"Content-Type": {"application/json"}}

}
