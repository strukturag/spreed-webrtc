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

package main

import (
	"bytes"
	"html/template"
	"testing"
)

const (
	templateString = `<script type="application/json">{{json .}}</script>`
	expectedString = `<script type="application/json">{"name":"Peter"}</script>`
)

type testPerson struct {
	Name string `json:"name"`
}

func TestHTMLTemplateWithJSON(t *testing.T) {
	tmpl := template.New("").Funcs(templateFuncMap())
	if _, err := tmpl.Parse(templateString); err != nil {
		t.Fatalf("Could not parse template '%s': %s", templateString, err.Error())
	}
	buf := bytes.NewBuffer(nil)
	tmpl.Execute(buf, testPerson{Name: "Peter"})
	out := buf.String()
	if out != expectedString {
		t.Fatalf("Strings do not match: got '%s', want '%s'", out, expectedString)
	}
}
