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
	Title              string   // Title
	ver                string   // Version (not exported to Javascript)
	S                  string   // Static URL prefix with version
	B                  string   // Base URL
	StunURIs           []string // STUN server URIs
	TurnURIs           []string // TURN server URIs
	Tokens             bool     // True when we got a tokens file
	Version            string   // Server version number
	globalRoomid       string   // Id of the global room (not exported to Javascript)
	defaultRoomEnabled bool     // Flag to enable default room ("")
	Plugin             string   // Plugin to load
}

func NewConfig(title, ver, runtimeVersion, basePath string, stunURIs, turnURIs []string, tokens bool, globalRoomid string, defaultRoomEnabled bool, plugin string) *Config {
	sv := fmt.Sprintf("static/ver=%s", ver)
	return &Config{Title: title, ver: ver, S: sv, B: basePath, StunURIs: stunURIs, TurnURIs: turnURIs, Tokens: tokens, Version: runtimeVersion, globalRoomid: globalRoomid, defaultRoomEnabled: defaultRoomEnabled, Plugin: plugin}
}
