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
	return ["$window", "$rootScope", "mediaStream", function($window, $rootScope, mediaStream) {

		var link = function($scope) {

			//console.log("roomBar directive link", arguments);
			$scope.newroomid = $rootScope.roomid;
			$scope.hideRoomBar = true;

			$scope.save = function() {
				var roomid = mediaStream.changeRoom($scope.newroomid);
				if (roomid !== $rootScope.roomid) {
					$scope.roombarform.$setPristine();
				}
				$scope.hideRoomBar = true;
			};

			$scope.hitEnter = function(evt) {
				if (angular.equals(evt.keyCode, 13)) {
					$scope.save();
				}
			};

			$scope.exit = function() {
				$scope.newroomid = "";
				$scope.save();
			};

			$rootScope.$watch("roomid", function(newroomid, roomid) {
				if (!newroomid) {
					newroomid = "";
				}
				$scope.newroomid = newroomid;
			});

			$scope.$watch("newroomid", function(newroomid) {
				if (newroomid === $rootScope.roomid) {
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
