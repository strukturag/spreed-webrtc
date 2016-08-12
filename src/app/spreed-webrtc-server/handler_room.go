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

package main

import (
	"net/http"

	"github.com/strukturag/spreed-webrtc/go/channelling"

	"github.com/gorilla/mux"
)

func roomHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	handleRoomView(vars["room"], w, r)
}

func handleRoomView(room string, w http.ResponseWriter, r *http.Request) {
	var err error

	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Header().Set("Expires", "-1")
	w.Header().Set("Cache-Control", "private, max-age=0")

	csp := false

	if config.ContentSecurityPolicy != "" {
		w.Header().Set("Content-Security-Policy", config.ContentSecurityPolicy)
		csp = true
	}
	if config.ContentSecurityPolicyReportOnly != "" {
		w.Header().Set("Content-Security-Policy-Report-Only", config.ContentSecurityPolicyReportOnly)
		csp = true
	}

	scheme := "http"

	// Detect if the request was made with SSL.
	ssl := r.TLS != nil
	proto, ok := r.Header["X-Forwarded-Proto"]
	if ok {
		ssl = proto[0] == "https"
		scheme = "https"
	}

	// Get languages from request.
	langs := getRequestLanguages(r, []string{})
	if len(langs) == 0 {
		langs = append(langs, "en")
	}

	// Prepare context to deliver to HTML..
	context := &channelling.Context{
		Cfg:        config,
		App:        "main",
		Host:       r.Host,
		Scheme:     scheme,
		Ssl:        ssl,
		Csp:        csp,
		Languages:  langs,
		Room:       room,
		S:          config.S,
		ExtraDHead: templatesExtraDHead,
		ExtraDBody: templatesExtraDBody,
	}

	// Get URL parameters.
	r.ParseForm()

	// Check if incoming request is a crawler which supports AJAX crawling.
	// See https://developers.google.com/webmasters/ajax-crawling/docs/getting-started for details.
	if _, ok := r.Form["_escaped_fragment_"]; ok {
		// Render crawlerPage template..
		err = templates.ExecuteTemplate(w, "crawlerPage", context)
	} else {
		// Render mainPage template.
		err = templates.ExecuteTemplate(w, "mainPage", context)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
