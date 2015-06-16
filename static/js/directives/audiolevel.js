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
define(['jquery', 'underscore'], function($, _) {

	return ["$window", "webrtc", "safeApply", "animationFrame", function($window, webrtc, safeApply, animationFrame) {

		// Consider anyting lower than this % as no audio.
		var threshhold = 5;
		// Starting from this value we are considered talking.
		var activityThreshold = 20;
		var activityThresholdInactivity = 12;
		var activityMuliplier = 1.4;
		var activityHistorySize = 4;

		// Talking status history map.
		var talkingStatus = {};

		// Usermedia reference.
		var usermedia = null;
		webrtc.e.on("usermedia", function(event, um) {
			console.log("Audio level user media changed", um);
			usermedia = um;
		});

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			$scope.talking = false;
			this.active = false;

			// Own audio level indicator.
			var element = $element[0];
			var width = 0;
			this.update = _.bind(function() {
				if (this.active || width > 0) {
					if (usermedia && usermedia.audioLevel) {
						width = Math.round(100 * usermedia.audioLevel);
						// Hide low volumes.
						if (width < threshhold) {
							width = 0;
						}
					} else {
						width = 0;
					}
					element.style.width = width + '%';
				}
			}, this);
			animationFrame.register(this.update);

			// Talking state.
			this.audioActivityHistory = [];
			this.audioActivityMeter = 0;

			this.meter = _.bind(function() {

				var talking;
				if (this.active && usermedia) {
					var level = Math.round(100 * usermedia.audioLevel);
					if (level < threshhold) {
						level = 0;
					} else {
						level = level * activityMuliplier;
					}
					this.audioActivityHistory.push(level);
					if (this.audioActivityHistory.length > activityHistorySize) {
						this.audioActivityHistory.shift();
					}
					this.audioActivityMeter = this.audioActivityHistory.reduce(function(a, b) {
						return a + b;
					}) / this.audioActivityHistory.length;
					//console.log("audioActivityMeter", this.audioActivityMeter, $scope.talking);
					if (!$scope.talking) {
						talking = this.audioActivityMeter > activityThreshold ? true : false;
					} else {
						talking = this.audioActivityMeter > activityThresholdInactivity ? true : false;
					}
				} else {
					// Clean up.
					//console.log("cleaning up");
					this.audioActivityHistory = [];
					this.audioActivityMeter = 0;
					talking = false;
				}
				if (talking !== $scope.talking) {
					// Apply to scope.
					//console.log("talking changed", talking);
					safeApply($scope, function() {
						$scope.talking = talking;
					});
				}

				// Check peer changes and update state for peers and keep history.
				var talkingStatusNew = {};
				webrtc.callForEachCall(_.bind(function(peercall) {
					if (peercall.peerconnection && peercall.peerconnection.datachannelReady) {
						var send = false;
						if (talking) {
							if (!talkingStatus[peercall.id]) {
								send = true;
							}
							talkingStatusNew[peercall.id] = talking;
						} else if (!talking && talkingStatus[peercall.id]) {
							send = true;
						}
						if (send) {
							peercall.peerconnection.send({
								Type: "Talking",
								Talking: talking
							});
						}
					}
				}, this));
				talkingStatus = talkingStatusNew;

			}, this);
			this.meter();

			this.meterInterval = null;
			this.check = function() {
				if ($scope.peer && !$scope.microphoneMute && !this.active) {
					this.active = true;
					//console.log("activating");
					_.defer(_.bind(function() {
						this.meter();
						this.update();
						this.meterInterval = $window.setInterval(this.meter, 150);
					}, this));
				} else if ((!$scope.peer || $scope.microphoneMute) && this.active) {
					this.active = false;
					//console.log("deactivating");
					_.defer(_.bind(function() {
						$window.clearInterval(this.meterInterval);
						this.meterInterval = null;
						this.meter(); // Run a last time, to clean up.
					}, this));
				}
			}

			// Only enable updater when actually talking.
			$scope.$watch("peer", _.bind(this.check, this));
			$scope.$watch("microphoneMute", _.bind(this.check, this));

		}];

		return {
			restrict: 'CE',
			controller: controller
		}

	}];

});
