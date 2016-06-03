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
	"fmt"
	"net/http"
	"net/url"

	"github.com/strukturag/spreed-webrtc/go/channelling"

	"github.com/gorilla/mux"
)

func sandboxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	// NOTE(longsleep): origin_scheme is window.location.protocol (eg. https:, http:).
	originURL, err := url.Parse(fmt.Sprintf("%s//%s", vars["origin_scheme"], vars["origin_host"]))
	if err != nil || originURL.Scheme == "" || originURL.Host == "" {
		http.Error(w, "Invalid origin path", http.StatusBadRequest)
		return
	}
	origin := fmt.Sprintf("%s://%s", originURL.Scheme, originURL.Host)

	handleSandboxView(vars["sandbox"], origin, w, r)
}

func handleSandboxView(sandbox string, origin string, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.Header().Set("Expires", "-1")
	w.Header().Set("Cache-Control", "private, max-age=0")

	sandboxTemplateName := fmt.Sprintf("%s_sandbox.html", sandbox)

	// Prepare context to deliver to HTML..
	if t := templates.Lookup(sandboxTemplateName); t != nil {

		// CSP support for sandboxes.
		var csp string
		switch sandbox {
		case "odfcanvas":
			csp = fmt.Sprintf("default-src 'none'; script-src %s; img-src data: blob:; style-src 'unsafe-inline'", origin)
		case "pdfcanvas":
			csp = fmt.Sprintf("default-src 'none'; script-src %s 'unsafe-eval'; img-src 'self' data: blob:; style-src 'unsafe-inline'", origin)
		default:
			csp = "default-src 'none'"
		}
		w.Header().Set("Content-Security-Policy", csp)

		// Prepare context to deliver to HTML..
		context := &channelling.Context{Cfg: config, Origin: origin, Csp: true}
		err := t.Execute(w, &context)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}

	} else {
		http.Error(w, "404 Unknown Sandbox", http.StatusNotFound)
	}
}
