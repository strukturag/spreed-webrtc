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

"use strict";
define(['underscore', 'jquery'], function(_, $) {

	// contactData
	return [function() {

		var contacts = {};
		var users = {};
		var count = 0;

		var contactData = {
			clear: function(cb) {
				_.each(users, _.bind(function(idx, userid) {
					var contact = contacts[idx];
					if (cb && contact) {
						cb(contact);
					}
					this.remove(userid);
				}, this));
				count = 0;
			},
			addByRequest: function(request, status) {
				//console.log("addByRequest", request, status);
				var userid = request.Userid;
				var token = request.Token;
				var id;
				if (users.hasOwnProperty(userid)) {
					// Existing contact. Replace it.
					id = users[userid];
				} else {
					id = String(count++);
					users[userid] = id;
				}
				var contact = contacts[id] = {
					Id: "contact-"+id,
					Userid: userid,
					Token: token,
					Status: null
				}
				return contact;
			},
			addByData: function(data) {
				//console.log("addByData", data.Userid, data);
				var userid = data.Userid;
				var id;
				if (users.hasOwnProperty(userid)) {
					id = users[userid];
				} else {
					id = String(count++);
					users[userid] = id;
				}
				var contact = contacts[id] = data;
				contact.Id = id;
				return contact;
			},
			get: function(userid) {
				if (users.hasOwnProperty(userid)) {
					var id = users[userid];
					return contacts[id];
				}
				return null;
			},
			remove: function(userid) {
				if (users.hasOwnProperty(userid)) {
					var id = users[userid];
					delete contacts[id];
				}
				delete users[userid];
			},
			getById: function(id) {
				if (id.indexOf("contact-") === 0) {
					id = id.substr(8);
				}
				if (contacts.hasOwnProperty(id)) {
					return contacts[id];
				}
				return null;
			},
			getAll: function() {
				return _.values(contacts);
			}
		};

		return contactData;

	}];

});
