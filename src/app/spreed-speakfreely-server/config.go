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
	"fmt"
)

type Config struct {
	Title                  string   // Title
	ver                    string   // Version (not exported to Javascript)
	S                      string   // Static URL prefix with version
	B                      string   // Base URL
	Token                  string   // Server token
	StunURIs               []string // STUN server URIs
	TurnURIs               []string // TURN server URIs
	Tokens                 bool     // True when we got a tokens file
	Version                string   // Server version number
	UsersEnabled           bool     // Flag if users are enabled
	UsersAllowRegistration bool     // Flag if users can register
	Plugin                 string   // Plugin to load
	globalRoomid           string   // Id of the global room (not exported to Javascript)
	defaultRoomEnabled     bool     // Flag if default room ("") is enabled
}

func NewConfig(title, ver, runtimeVersion, basePath, serverToken string, stunURIs, turnURIs []string, tokens bool, globalRoomid string, defaultRoomEnabled, usersEnabled, usersAllowRegistration bool, plugin string) *Config {
	sv := fmt.Sprintf("static/ver=%s", ver)
	return &Config{
		Title:                  title,
		ver:                    ver,
		S:                      sv,
		B:                      basePath,
		Token:                  serverToken,
		StunURIs:               stunURIs,
		TurnURIs:               turnURIs,
		Tokens:                 tokens,
		Version:                runtimeVersion,
		UsersEnabled:           usersEnabled,
		UsersAllowRegistration: usersAllowRegistration,
		Plugin:                 plugin,
		globalRoomid:           globalRoomid,
		defaultRoomEnabled:     defaultRoomEnabled,
	}
}
