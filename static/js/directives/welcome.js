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
define([], function() {

	// welcome
	return ["rooms", "$timeout", "mediaStream", function(rooms, $timeout, mediaStream) {

		function link($scope, $element) {
			//console.log("xxx welcome", $scope.$id, $element);

			$scope.randomRoom = rooms.randomRoom;
			$scope.canCreateRooms = rooms.canCreateRooms;
			$scope.joinRoomByName = function(name) {
				if ($scope.welcome.$invalid) {
					return;
				}
				if (!name) {
					return;
				}
				rooms.joinByName(name);
			};

			var roomdata = rooms.getRandomRoom();
			if (roomdata) {
				$scope.roomdata = {name: roomdata.name}
			} else {
				$scope.roomdata = {};
			}

			$scope.roomdataInput = {
				name: ""
			};

			$scope.$watch("roomdata.name", function(name) {
				$scope.roomdata.link = rooms.link({Name: name});
			}, true);

			$scope.$watch("roomdataInput.name", function(name) {
				if (name === "") {
					$scope.randomRoom();
				} else {
					$scope.roomdata.name = name;
				}
			});

			$scope.$on("room.random", function(event, roomdata) {
				$scope.roomdata = {name: roomdata.name, last: roomdata.name};
				$scope.roomdataInput.name = "";
			});

			$timeout(function() {
				$element.find(".roomdata-link-input:visible:enabled:first").focus();
			});

		}

		return {
			restrict: 'EA',
			link: link
		}

	}];

});
