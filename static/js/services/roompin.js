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
define([
], function() {

	return ["$window", "$q", "alertify", "translation", function($window, $q, alertify, translation) {

		var pinCache = {};
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
					alertify.dialog.alert(translation._("PIN for room %s is now '%s'.", roomName, pin));
				} else {
					roompin.clear(roomName);
					alertify.dialog.alert(translation._("PIN lock has been removed from room %s.", roomName));
				}
			},
			requestInteractively: function(roomName) {
				var deferred = $q.defer();
				alertify.dialog.prompt(translation._("Enter the PIN for room %s", roomName), function(pin) {
					if (pin) {
						pinCache[roomName] = pin;
						deferred.resolve();
					} else {
						deferred.reject();
					}
				}, function() {
					deferred.reject();
				});
				return deferred.promise;
			}
		};

		return roompin;

	}];
});
