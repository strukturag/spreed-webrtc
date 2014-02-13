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

import ()

type User struct {
	Id        string
	Roomid    string
	Ua        string
	UpdateRev uint64
	Status    interface{}
}

func (u *User) Update(update *UserUpdate) uint64 {

	//user := reflect.ValueOf(&u).Elem()

	for _, key := range update.Types {

		//fmt.Println("type update", key)
		switch key {
		case "Roomid":
			u.Roomid = update.Roomid
		case "Ua":
			u.Ua = update.Ua
		case "Status":
			u.Status = update.Status
		}

	}

	u.UpdateRev++
	return u.UpdateRev

}

type UserUpdate struct {
	Id     string
	Types  []string
	Roomid string
	Ua     string
	Status interface{}
}
