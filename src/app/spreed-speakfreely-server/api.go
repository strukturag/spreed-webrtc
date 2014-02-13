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
	"app/spreed-speakfreely-server/sleepy"
	"github.com/gorilla/mux"
	"github.com/strukturag/httputils"
)

type ApiError struct {
	Id      string `json:"code"`
	Message string `json:"message"`
	Success bool   `json:"success"`
}

func NewApiError(id, message string) *ApiError {
	return &ApiError{id, message, false}
}

func makeApiHandler(r *mux.Router, tokenProvider TokenProvider) {

	a := r.PathPrefix("/api/v1/").Subrouter()
	api := sleepy.NewAPI(a)

	rooms := &Rooms{}
	api.AddResource(rooms, "/rooms")

	tokens := &Tokens{tokenProvider}
	api.AddResourceWithWrapper(tokens, httputils.MakeGzipHandler, "/tokens")

}
