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
define(['jquery', 'underscore', 'text!partials/usability.html'], function($, _, template) {

	var MEDIA_CHECK = "1" // First version of media check flag.

	return [function() {

		var controller = ['$scope', "webrtc", "safeApply", "$timeout", "localStorage", "continueConnector", function($scope, webrtc, safeApply, $timeout, localStorage, continueConnector) {

			var pending = true;
			var complete = false;

			var ctrl = this;
			ctrl.setInfo = function(info) {
				$scope.usabilityInfo = info;
			};
			ctrl.setInfo("waiting");

			var continueDeferred = continueConnector.defer();

			$scope.continueConnect = function(status) {
				safeApply($scope, function() {
					pending = false;
					if (status) {
						localStorage.setItem("mediastream-mediacheck", MEDIA_CHECK)
						console.log("Continue with connect after media check ...");
						continueDeferred.resolve();
						ctrl.setInfo("ok");
						complete = true;
					} else {
						ctrl.setInfo("denied");
					}
				});
			};

			$scope.testMediaAccess = function() {
				//console.log("Test media access");
				var passedBefore = localStorage.getItem("mediastream-mediacheck");
				if (passedBefore !== MEDIA_CHECK && $scope.isChrome) {
					// NOTE(longsleep): Checkin for media access makes only sense on
					// Chrome for now, as its the only one which remembers this
					// decision permanently for https.
					webrtc.testMediaAccess($scope.continueConnect);
				} else {
					$scope.continueConnect(true);
				}
			};

			$scope.retry = function() {
				ctrl.setInfo("usermedia");
				$scope.testMediaAccess();
			};

			// Toplevel watcher for connect function to become available.
			$scope.$watch("connect", function() {
				if ($scope.connect) {
					console.log("Checking for media access ...");
					ctrl.setInfo("checking");
					$timeout(function() {
						if (pending) {
							safeApply($scope, function() {
								ctrl.setInfo("usermedia");
							});
						}
					}, 500);
					$scope.testMediaAccess();
				}
			});

			$scope.$on("room.joined", function(event) {
				if (complete) {
					ctrl.setInfo("ok");
				}
			});

			$scope.$on("room.left", function(event) {
				if (complete) {
					ctrl.setInfo("ok");
				}
			});

		}];

		return {
			restrict: 'E',
			replace: true,
			template: template,
			controller: controller
		}

	}];

});
