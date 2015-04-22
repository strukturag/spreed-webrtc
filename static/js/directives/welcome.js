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
define([], function() {

	// welcome
	return ["rooms", "$timeout", "mediaStream", "translation", function(rooms, $timeout, mediaStream, translation) {

		function link($scope, $element) {
			//console.log("xxx welcome", $scope.$id, $element);

			var placeHolder = translation._("Room name");

			$scope.randomRoom = rooms.randomRoom;
			$scope.canCreateRooms = rooms.canCreateRooms;
			$scope.canJoinRooms = rooms.canJoinRooms;
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
			var recreate = true;
			if (roomdata) {
				$scope.roomdata = {name: roomdata.name, placeholder: roomdata.name ? roomdata.name : placeHolder};
				recreate = false;
			} else {
				$scope.roomdata = {placeholder: placeHolder};
			}

			$scope.roomdataInput = {
				name: ""
			};

			$scope.$watch("roomdata.name", function(name) {
				$scope.roomdata.link = rooms.link({Name: name});
			}, true);

			$scope.$watch("roomdataInput.name", function(name) {
				if (name === "") {
					if (recreate) {
						$scope.randomRoom();
					} else {
						recreate = true;
					}
				} else {
					$scope.roomdata.name = name;
				}
			});

			$scope.$on("room.random", function(event, roomdata) {
				$scope.roomdata = {name: roomdata.name, last: roomdata.name, placeholder: roomdata.name ? roomdata.name : placeHolder};
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
