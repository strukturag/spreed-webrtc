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
define(['text!partials/page.html', 'text!partials/page/welcome.html'], function(template, welcome) {

	return ["$templateCache", "$timeout", "rooms", function($templateCache, $timeout, rooms) {
		$templateCache.put('page/welcome.html', welcome);

		var link = function($scope, $element, attrs) {
			$scope.randomRoom = rooms.randomRoom;

			$scope.$on("room.joined", function(event) {
				$scope.page = null;
			});

			$scope.$on("room.random", function(ev, roomdata) {
				$scope.page = "page/welcome.html";
				$scope.roomdata = roomdata;
				$timeout(function() {
					$element.find(".btn-roomcreate:visible:enabled:first").focus();
				});
			});

			$scope.roomdata = {};
			$scope.$watch("roomdata.name", function(name) {
				$scope.roomdata.link = rooms.link($scope.roomdata);
			});
		};

		return {
			restrict: 'E',
			replace: true,
			template: template,
			controller: "RoomchangeController",
			link: link
		};
	}];

});
