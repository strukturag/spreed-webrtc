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
define([
	'jquery'
], function($) {

	return ["$window", "$location", "$timeout", "$route", "$rootScope", "$http", "globalContext", "safeApply", "connector", "api", "restURL", function($window, $location, $timeout, $route, $rootScope, $http, globalContext, safeApply, connector, api, restURL) {
		var url = restURL.api("rooms");
		var requestedRoomName = "";
		var currentRoom = null;

		var joinRequestedRoom = function() {
			if ($rootScope.authorizing()) {
				// Do nothing while authorizing.
				return;
			}

			if (!connector.connected || requestedRoomName !== currentRoom) {
				if (requestedRoomName !== "" || globalContext.Cfg.DefaultRoomEnabled) {
					console.log("Joining room", requestedRoomName);
					requestedRoomName = requestedRoomName ? requestedRoomName : "";
					api.sendHello(requestedRoomName);
					api.requestUsers();
				} else {
					console.log("Default room disabled, requesting a random room.");
					setCurrentRoom(null);
					rooms.randomRoom();
				}
			}
		};

		// Cache events, to avoid ui flicker during quick room changes.
		var nextRoom = null;
		var setCurrentRoom = function(room) {
			nextRoom = room;

			$timeout(function() {
				if (nextRoom !== currentRoom) {
					var priorRoom = currentRoom;
					currentRoom = nextRoom;
					if (priorRoom) {
						console.log("Left room", priorRoom.name);
						$rootScope.$broadcast("room.left", priorRoom);
					}
					if (currentRoom) {
						console.log("Joined room", currentRoom.name);
						$rootScope.$broadcast("room.joined", currentRoom);
					}
				}
			}, 100);
		};

		connector.e.on("close error", function() {
			setCurrentRoom(null);
		});

		api.e.on("received.self", function(event, data) {
			joinRequestedRoom();
		});

		api.e.on("received.users", function() {
			setCurrentRoom({
				name: requestedRoomName
			});
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
				joinRequestedRoom();
			} else {
				$rootScope.$broadcast("rooms.ready");
			}
		});

		var rooms = {
			inDefaultRoom: function() {
				return (currentRoom !== null ? currentRoom.name : requestedRoomName) === "";
			},
			randomRoom: function() {
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
					$rootScope.$broadcast('room.random', {name: data.name});
				}).
				error(function() {
					console.error("Failed to retrieve random room data.");
					$rootScope.$broadcast('room.random', {});
				});
			},
			joinByName: function(name, replace) {
				name = $window.encodeURIComponent(name);
				name = name.replace(/^%40/, "@");
				name = name.replace(/^%24/, "$");
				name = name.replace(/^%2B/, "+");

				safeApply($rootScope, function(scope) {
					$location.path("/" + name);
					if (replace) {
						$location.replace();
					}
				});
				return name;
			},
			link: function(room) {
				var name = room ? room.name : null;
				if (!name) {
					name = "";
				}
				return restURL.room(name);
			}
		};

		return rooms;
    }];
});
