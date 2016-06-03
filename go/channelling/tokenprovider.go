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
	"encoding/csv"
	"log"
	"os"
	"strings"
)

type TokenProvider func(token string) string

type TokenFile struct {
	Path   string
	Info   os.FileInfo
	Reload func()
	Tokens map[string]bool
}

func (tf *TokenFile) ReloadIfModified() error {
	info, err := os.Stat(tf.Path)
	if err != nil {
		log.Printf("Failed to loaad token file: %s", err)
		return err
	}
	if tf.Info == nil || tf.Info.ModTime() != info.ModTime() {
		tf.Info = info
		tf.Reload()
	}

	return nil
}

func reloadRokens(tf *TokenFile) {
	r, err := os.Open(tf.Path)
	if err != nil {
		panic(err)
	}

	csvReader := csv.NewReader(r)
	csvReader.Comma = ':'
	csvReader.Comment = '#'
	csvReader.TrimLeadingSpace = true

	records, err := csvReader.ReadAll()
	if err != nil {
		panic(err)
	}

	tf.Tokens = make(map[string]bool)
	for _, record := range records {
		tf.Tokens[strings.ToLower(record[0])] = true
	}
}

func TokenFileProvider(filename string) TokenProvider {
	tf := &TokenFile{Path: filename}
	tf.Reload = func() { reloadRokens(tf) }
	return func(token string) string {
		tf.ReloadIfModified()
		_, exists := tf.Tokens[token]
		if !exists {
			return ""
		}
		return token
	}
}
