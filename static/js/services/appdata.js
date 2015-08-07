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
define(["jquery"], function($) {

	// appData.e events:
	// Subscribe these events with appData.e.on(eventname, function() {}).
	//
	// - authenticationChanged(event, userid, suserid)
	//     userid (string)  : Public user id of the authenticated user.
	//     suserid (string) : Private user id of the authenticated user.
	//
	// - selfReceived(event, self)
	//     self (object) : Self document as received from API.
	//
	// - uiNotification(event, type, details)
	//     type (string)    : Notification type (busy, reject, pickuptimeout,
	//                        incomingbusy, incomingpickuptimeout, chatmessage)
	//     details (object) : Depends on event type.
	//
	// - mainStatus(event, status)
	//     status (string)  : Status id (connected, waiting, ...)
	//
	// - authorizing(event, flag, userid)
	//     flag (bool)      : True if authorizing phase, else false.
	//     userid (string)  : User id if a user was authorized.
	//
	// - userSettingsLoaded(event, loaded, user_settings)
	//     loaded (bool)    : True if something was loaded, else false.
	//     user_settings (map) : User map which was loaded.
	//
	// Other appData properties:
	//
	// - language (string) : ISO language code of active language.
	// - id (string)       : Random string generated on app startup.
	// - flags (map)       : Flag table.

	// appData
	return ["randomGen", "$window", function(randomGen, $window) {

		var service = this;

		service.e = $({});
		service.data = null;
		service.flags = {
			authorizing: false,
			resurrect: null
		};

		service.language = $window.document.getElementsByTagName("html")[0].getAttribute("lang");
		service.id = randomGen.id();

		service.get = function() {
			return service.data;
		};
		service.set = function(d) {
			service.data = d;
			return d;
		};
		service.authorizing = function(value, userid) {
			// Boolean flag to indicate that an authentication is currently in progress.
			if (typeof(value) !== "undefined") {
				var v = !!value;
				if (v !== service.flags.authorizing) {
					service.flags.authorizing = v;
					service.e.triggerHandler("authorizing", v, userid);
				}
			}
			return service.flags.authorizing;
		};

		console.info("App runtime id: "+service.id);
		return service;

	}];

});
