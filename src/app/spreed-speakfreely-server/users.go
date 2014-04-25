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
	"errors"
	"github.com/strukturag/phoenix"
	"log"
	"strconv"
	"strings"
	"time"
)

type UsersHandler interface {
	Validate(snr *SessionNonceRequest) (string, error)
}

type UsersSharedsecretHandler struct {
	secret []byte
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

	// Check HMAC.
	foo := hmac.New(sha256.New, uh.secret)
	foo.Write([]byte(snr.UseridCombo))
	fooSecret := base64.StdEncoding.EncodeToString(foo.Sum(nil))
	if snr.Secret != fooSecret {
		return "", errors.New("invalid secret")
	}

	return userid, nil
}

type Users struct {
	Enabled bool
	Handler UsersHandler
}

func NewUsers(runtime phoenix.Runtime) *Users {

	enabled := false
	enabledString, err := runtime.GetString("users", "enabled")
	if err == nil {
		enabled = enabledString == "true"
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
			log.Printf("Enabled users handler '%s'.\n", mode)
		}

	}

	return &Users{
		Enabled: enabled,
		Handler: handler,
	}

}
