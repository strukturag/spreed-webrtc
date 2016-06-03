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
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/strukturag/spreed-webrtc/go/channelling"

	"github.com/gorilla/mux"
)

type Pipelines struct {
	channelling.PipelineManager
	API channelling.ChannellingAPI
}

func (pipelines *Pipelines) Get(request *http.Request) (int, interface{}, http.Header) {
	vars := mux.Vars(request)
	id, ok := vars["id"]
	if !ok {
		return http.StatusNotFound, "", nil
	}

	pipeline, ok := pipelines.GetPipelineByID(id)
	if !ok {
		return http.StatusNotFound, "", nil
	}

	since := 0
	limit := 0
	if sinceParam := request.Form.Get("since"); sinceParam != "" {
		since, _ = strconv.Atoi(sinceParam)
	}
	if limitParam := request.Form.Get("limit"); limitParam != "" {
		limit, _ = strconv.Atoi(limitParam)
	}

	result, err := pipeline.JSONFeed(since, limit)
	if err != nil {
		return http.StatusInternalServerError, err.Error(), nil
	}

	return http.StatusOK, result, nil
}

func (pipelines *Pipelines) Post(request *http.Request) (int, interface{}, http.Header) {
	vars := mux.Vars(request)
	id, ok := vars["id"]
	if !ok {
		return http.StatusNotFound, "", nil
	}

	pipeline, ok := pipelines.GetPipelineByID(id)
	if !ok {
		return http.StatusNotFound, "", nil
	}

	var incoming channelling.DataIncoming
	dec := json.NewDecoder(request.Body)
	if err := dec.Decode(&incoming); err != nil {
		return http.StatusBadRequest, err.Error(), nil
	}

	result := &channelling.DataOutgoing{
		From: pipeline.FromSession().Id,
		Iid:  incoming.Iid,
	}
	session := pipeline.ToSession()
	reply, err := pipelines.API.OnIncoming(pipeline, session, &incoming)
	if err == nil {
		result.Data = reply
	} else {
		result.Data = err
	}
	pipelines.API.OnIncomingProcessed(pipeline, session, &incoming, reply, err)

	return http.StatusOK, result, nil
}
