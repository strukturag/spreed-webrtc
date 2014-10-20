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
define(['underscore', 'text!partials/roombar.html'], function(_, template) {

	// roomBar
	return ["$window", "rooms", function($window, rooms) {

		var link = function($scope) {

			//console.log("roomBar directive link", arguments);
			$scope.layout.roombar = false;

			$scope.save = function() {
				var roomName = rooms.joinByName($scope.newRoomName);
				if (roomName !== $scope.currentRoomName) {
					$scope.roombarform.$setPristine();
				}
				$scope.layout.roombar = false;
			};

			$scope.hitEnter = function(evt) {
				if (angular.equals(evt.keyCode, 13)) {
					$scope.save();
				}
			};

			$scope.exit = function() {
				$scope.newRoomName = "";
				$scope.save();
			};

			$scope.$on("room.joined", function(ev, room) {
				$scope.currentRoomName = $scope.newRoomName = room.Name;
			});

			$scope.$on("room.left", function(ev) {
				$scope.currentRoomName = $scope.newRoomName = "";
			});

			$scope.$watch("newRoomName", function(name) {
				if (name === $scope.currentRoomName) {
					$scope.roombarform.$setPristine();
				}
			});

		};

		return {
			restrict: 'E',
			replace: true,
			scope: true,
			template: template,
			controller: "RoomchangeController",
			link: link
		}

	}];

});
