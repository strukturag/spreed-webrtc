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
define(['text!partials/page.html', 'text!partials/page/welcome.html'], function(template, welcome) {

	return ["$templateCache", "$timeout", "rooms", function($templateCache, $timeout, rooms) {

		$templateCache.put('page/welcome.html', welcome);

		var link = function($scope, $element, attrs) {
			$scope.$on("room.joined", function(event) {
				// Show no page when joined a room.
				$scope.page = null;
			});
			$scope.$on("room.random", function(ev, roomdata) {
				// Show welcome page on room random events.
				$scope.layout.roombar = false;
				$timeout(function() {
					$scope.page = "page/welcome.html";
				});
			});
		};

		return {
			restrict: 'E',
			replace: true,
			template: template,
			link: link
		};
	}];

});
