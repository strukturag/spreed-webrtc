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
	'angular',
	'jquery',
	'underscore'
], function(angular, $, _) {

	return ["$window", "$location", "$timeout", "$q", "$route", "$rootScope", "$http", "globalContext", "safeApply", "connector", "api", "restURL", "roompin", "appData", "alertify", "translation", "mediaStream", function($window, $location, $timeout, $q, $route, $rootScope, $http, globalContext, safeApply, connector, api, restURL, roompin, appData, alertify, translation, mediaStream) {

		var body = $("body");

		var url = restURL.api("rooms");
		var requestedRoomName = "";
		var priorRoomName = null;
		var helloedRoomName = null;
		var currentRoom = null;
		var randomRoom = null;
		var canJoinRooms = !mediaStream.config.AuthorizeRoomJoin;
		var canCreateRooms = canJoinRooms ? !mediaStream.config.AuthorizeRoomCreation : false;

		var rooms;
		var joinFailed;
		var joinRequestedRoom;
		var setCurrentRoom;
		var updateRoom;
		var applyRoomUpdate;

		joinFailed = function(error) {
			setCurrentRoom(null);

			switch(error.Code) {
			case "default_room_disabled":
				priorRoomName = null;
				rooms.randomRoom();
				break;
			case "invalid_credentials":
				roompin.clear(requestedRoomName);
				/* falls through */
			case "authorization_required":
				roompin.requestInteractively(requestedRoomName).then(joinRequestedRoom,
				function() {
					console.log("Authentication cancelled, try a different room.");
					rooms.joinPriorOrDefault(true);
				});
				break;
			case "authorization_not_required":
				roompin.clear(requestedRoomName);
				joinRequestedRoom();
				break;
			case "room_join_requires_account":
				console.log("Room join requires a logged in user.");
				alertify.dialog.notify("", translation._("Please sign in to create rooms."));
				rooms.joinPriorOrDefault(true);
				break;
			default:
				console.log("Unknown error", error, "while joining room ", requestedRoomName);
				break;
			}
		};

		joinRequestedRoom = function() {
			if (!connector.connected || appData.authorizing()) {
				// Do nothing while not connected or authorizing.
				return;
			}
			if (!currentRoom || requestedRoomName !== currentRoom.Name) {
				requestedRoomName = requestedRoomName ? requestedRoomName : "";
				if (helloedRoomName !== requestedRoomName) {
					helloedRoomName = requestedRoomName;
					var myHelloedRoomName = helloedRoomName;
					_.defer(function() {
						if (helloedRoomName === myHelloedRoomName) {
							helloedRoomName = null;
						}
					});
					console.log("Joining room", [requestedRoomName]);
					api.sendHello(requestedRoomName, roompin.get(requestedRoomName), function(room) {
						setCurrentRoom(room);
					}, function(error) {
						joinFailed(error);
					});
				}
			}
		};

		setCurrentRoom = function(room) {
			if (room === currentRoom) {
				return;
			}
			var priorRoom = currentRoom;
			currentRoom = room;
			if (priorRoom) {
				body.removeClass("roomType" + priorRoom.Type);
				priorRoomName = priorRoom.Name;
				console.log("Left room", [priorRoom.Name]);
				$rootScope.$broadcast("room.left", priorRoom.Name);
			}
			if (currentRoom) {
				body.addClass("roomType" + currentRoom.Type);
				console.log("Joined room", [currentRoom.Name]);
				$rootScope.$broadcast("room.joined", currentRoom.Name);
			}
		};

		updateRoom = function(room) {
			var response = $q.defer();
			api.requestRoomUpdate(room, response.resolve, response.reject);
			return response.promise.then(applyRoomUpdate);
		};

		applyRoomUpdate = function(room) {
			if (room.Credentials) {
				roompin.update(currentRoom.Name, room.Credentials.PIN);
				delete room.Credentials;
			}
			currentRoom = room;
			$rootScope.$broadcast("room.updated", currentRoom);
			return room;
		};

		connector.e.on("close error", function() {
			setCurrentRoom(null);
		});

		api.e.on("received.room", function(event, room) {
			applyRoomUpdate(room);
		});

		appData.e.on("authorizing", function(event, value) {
			if (!value) {
				// NOTE(lcooper): This will have been skipped earlier, so try again.
				_.defer(joinRequestedRoom);
			}
		});

		appData.e.on("selfReceived", function(event, data) {
			_.defer(joinRequestedRoom);
			canJoinRooms = (!mediaStream.config.AuthorizeRoomJoin || $rootScope.myuserid) ? true : false
			if (canJoinRooms) {
				canCreateRooms = (!mediaStream.config.AuthorizeRoomCreation || $rootScope.myuserid) ? true : false;
			} else {
				canCreateRooms = false;
			}
		});

		$rootScope.$on("$locationChangeSuccess", function(event) {
			var roomName;
			if ($route.current) {
				roomName = $route.current.params.room;
				roomName = $window.decodeURIComponent(roomName);
			} else {
				roomName = "";
			}
			requestedRoomName = roomName;
			if (connector.connected) {
				_.defer(joinRequestedRoom);
			} else {
				$rootScope.$broadcast("rooms.ready");
			}
		});

		// Public API.
		rooms = {
			inDefaultRoom: function() {
				return (currentRoom !== null ? currentRoom.Name : requestedRoomName) === "";
			},
			randomRoom: function() {
				if (!canCreateRooms) {
					$timeout(function() {
						$rootScope.$broadcast('room.random', {});
					});
					return;
				}
				$http({
					method: "POST",
					url: url,
					data: $.param({}),
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}).
					success(function(data, status) {
						console.info("Retrieved random room data", data);
						if (!data.name) {
							data.name = "";
						}
						randomRoom = {name: data.name};
						$rootScope.$broadcast('room.random', randomRoom);
					}).
					error(function() {
						console.error("Failed to retrieve random room data.");
						randomRoom = {};
						$rootScope.$broadcast('room.random', randomRoom);
					});
			},
			getRandomRoom: function() {
				return randomRoom;
			},
			canCreateRooms: function() {
				return canCreateRooms;
			},
			canJoinRooms: function() {
				return canJoinRooms;
			},
			joinByName: function(name, replace) {
				var nn = restURL.encodeRoomURL(name, "", function(url) {
					// Apply new URL.
					safeApply($rootScope, function(scope) {
						$location.path(url);
						if (replace) {
							$location.replace();
						}
					});
				});
				return nn;
			},
			joinDefault: function(replace) {
				return rooms.joinByName("", replace);
			},
			joinPriorOrDefault: function(replace) {
				if (!priorRoomName || requestedRoomName === priorRoomName) {
					rooms.joinDefault(replace);
				} else {
					rooms.joinByName(priorRoomName, replace);
				}
			},
			link: function(room) {
				var name = room ? room.Name : null;
				if (!name) {
					name = "";
				}
				return restURL.room(name);
			},
			setPIN: function(pin) {
				pin = "" + pin;
				var newRoom = angular.copy(currentRoom);
				newRoom.Credentials = {PIN: pin};
				return updateRoom(newRoom).then(null, function(error) {
					console.log("Failed to set room PIN", error);
					return $q.reject(error);
				});
			}
		};

		// NOTE(lcooper): For debugging only, do not use this on production.
		$window.setRoomPIN = rooms.setPIN;

		return rooms;
    }];
});
