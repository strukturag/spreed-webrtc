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
	"moment"
], function(moment) {

	return ["$window", "$q", "globalContext", "alertify", "toastr", "translation", "safeMessage", "randomGen", "localStorage", function($window, $q, context, alertify, toastr, translation, safeMessage, randomGen, localStorage) {

		var pinCache = {};
		var getLocalStoragePINIDForRoom = function(roomName) {
			return "room-pin-" + roomName;
		};
		var lockedRoomsJoinable = !!context.Cfg.LockedRoomJoinableWithPIN;
		var roompin = {
			get: function(roomName) {
				var cachedPIN = pinCache[roomName];
				return cachedPIN ? cachedPIN : null;
			},
			clear: function(roomName) {
				delete pinCache[roomName];
				localStorage.removeItem(getLocalStoragePINIDForRoom(roomName));
				console.log("Cleared PIN for", roomName);
			},
			update: function(roomName, pin, noAlert) {
				if (pin) {
					pinCache[roomName] = pin;
					localStorage.setItem(getLocalStoragePINIDForRoom(roomName), pin);
					if (!noAlert && lockedRoomsJoinable) {
						alertify.dialog.alert(translation._("PIN for room %s is now '%s'.", safeMessage(roomName), safeMessage(pin)));
					}
				} else {
					roompin.clear(roomName);
					if (!noAlert && lockedRoomsJoinable) {
						toastr.info(moment().format("lll"), translation._("PIN lock has been removed from room '%s'", safeMessage(roomName)));
					}
				}
			},
			requestInteractively: function(roomName) {
				var deferred = $q.defer();
				var tryJoinWithStoredPIN = function() {
					var pin = localStorage.getItem(getLocalStoragePINIDForRoom(roomName));
					if (pin) {
						roompin.update(roomName, pin, true);
						deferred.resolve();
						return true;
					}
					return false;
				};
				if (lockedRoomsJoinable) {
					if (!tryJoinWithStoredPIN()) {
						alertify.dialog.prompt(translation._("Enter the PIN for room %s", safeMessage(roomName)), function(pin) {
							if (pin) {
								roompin.update(roomName, pin);
								deferred.resolve();
							} else {
								deferred.reject();
							}
						}, function() {
							deferred.reject();
						});
					}
				} else {
					if (!tryJoinWithStoredPIN()) {
						alertify.dialog.error(
							translation._("Can't join locked room '%s'.", safeMessage(roomName)),
							translation._("Room '%s' is locked. This server is configured to not let anyone join locked rooms.", safeMessage(roomName))
						);
						deferred.reject();
					}
				}
				return deferred.promise;
			},
			// Passing in "rooms" is a bit of a hack to prevent circular dependencies
			toggleCurrentRoomState: function(rooms) {
				if (!rooms.isLocked()) {
					// Lock
					if (lockedRoomsJoinable) {
						alertify.dialog.prompt(translation._("Please enter a new Room PIN to lock the room"), function(pin) {
							rooms.setPIN(pin);
						}, function() {
							// Do nothing
						});
					} else {
						alertify.dialog.confirm(translation._("Do you want to lock the room?"), function() {
							var pin = randomGen.random({hex: true});
							rooms.setPIN(pin);
						}, function() {
							// Do nothing
						});
					}
					return;
				}
				// Unlock
				alertify.dialog.confirm(translation._("Do you want to unlock the room?"), function() {
					rooms.setPIN("");
				}, function() {
					// Do nothing
				});
			}
		};

		return roompin;

	}];
});
