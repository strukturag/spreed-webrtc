/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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
define(['text!partials/page.html', 'text!partials/page/welcome.html'], function(template, welcome) {

	return ["$templateCache", function($templateCache) {

		$templateCache.put('page/welcome.html', welcome);

		var link = function(scope, element, attrs) {

			scope.room = false;
			scope.page = null;

			scope.$on("welcome", function() {
				if (!scope.initialized) {
					scope.initialized = true;
					scope.refresh();
				}
			});

			scope.$on("room", function(event, room) {
				scope.initialized = true;
				scope.room = room !== null ? true : false;
				scope.refresh();
			});

			scope.$watch("status", function(event) {
				if (scope.initialized) {
					scope.refresh();
				}
			});

			scope.refresh = function() {
				if (scope.roomid || scope.room || scope.status !== "waiting") {
					scope.page = null;
				} else {
					scope.page = "page/welcome.html";
				}
			};

		};

		return {
			restrict: 'E',
			replace: true,
			template: template,
			link: link
		}

	}];

});
