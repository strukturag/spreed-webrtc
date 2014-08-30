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
define([], function() {

	// RoomchangeController
	return ["$scope", "$element", "$window", "mediaStream", "$http", "$timeout", function($scope, $element, $window, mediaStream, $http, $timeout) {

		//console.log("Room change controller", $element, $scope.roomdata);

		var url = mediaStream.url.api("rooms");

		var ctrl = this;
		ctrl.enabled = true;

		ctrl.getRoom = function(cb) {
			$http({
				method: "POST",
				url: url,
				data: $.param({}),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}).
			success(function(data, status) {
				cb(data);
			}).
			error(function() {
				console.error("Failed to retrieve room link.");
				cb({});
			});
		};

		$scope.changeRoomToId = function(id) {
			return mediaStream.changeRoom(id);
		};

		$scope.refreshRoom = function() {
			if (ctrl.enabled) {
				ctrl.getRoom(function(roomdata) {
					console.info("Retrieved room data", roomdata);
					$scope.roomdata = roomdata;
					$element.find(".btn-roomcreate").get(0).focus();
				});
			}
		};

		$scope.$on("$destroy", function() {
			//console.log("Room change controller destroyed");
			ctrl.enabled = false;
		});

		$scope.roomdata = {};
		$scope.$watch("roomdata.name", function(n) {
			//console.log("roomdata.name changed", n);
			if (!n) {
				n = "";
			}
			var u = encodeURIComponent(n);
			$scope.roomdata.url = "/" + u;
			$scope.roomdata.link = mediaStream.url.room(n);
		});

		var roomDataLinkInput = $element.find(".roomdata-link-input");
		if (roomDataLinkInput.length) {
			$timeout(function() {
				$scope.refreshRoom();
			}, 100);
		}

	}];

});
