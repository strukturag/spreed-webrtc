/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
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
define([
], function() {

	return ["$window", "$q", function($window, $q) {

		var pinCache = {};

		// XXX(longsleep): This service needs to get rid of all window.alert and prompt calls.
		var roompin = {
			get: function(roomName) {
				var cachedPIN = pinCache[roomName];
				return cachedPIN ? cachedPIN : null;
			},
			clear: function(roomName) {
				delete pinCache[roomName];
				console.log("Cleared PIN for", roomName);
			},
			update: function(roomName, pin) {
				if (pin) {
					pinCache[roomName] = pin;
					$window.alert("PIN for room " + roomName + " is now '" + pin + "'");
				} else {
					roompin.clear(roomName);
					$window.alert("PIN lock has been removed from room " + roomName);
				}
			},
			requestInteractively: function(roomName) {
				var deferred = $q.defer();
				var pin = $window.prompt("Enter the PIN for " + roomName + " below");
				if (pin) {
					pinCache[roomName] = pin;
					deferred.resolve();
				} else {
					deferred.reject();
				}
				return deferred.promise;
			}
		};

		return roompin;

	}];
});
