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
define(['underscore', 'text!partials/buddylist.html'], function(_, template) {

	// buddyList
	return ["$compile", "buddyList", "mediaStream", function($compile, buddyList, mediaStream) {

		//console.log("buddyList directive");

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			$scope.layout.buddylist = false;
			$scope.enabled = false;

			$scope.doCall = function(id) {

				mediaStream.webrtc.doCall(id);

			};

			$scope.doChat = function(id) {

				//console.log("doChat", id);
				$scope.$emit("startchat", id, {
					autofocus: true,
					restore: true
				});

			};

			$scope.doContact = function(id) {

				//console.log("doContact", id);
				$scope.$emit("requestcontact", id, {
					restore: true
				});

			};

			$scope.doAudioConference = function(id) {

				$scope.updateAutoAccept(id);
				mediaStream.api.sendChat(id, null, {
					type: "conference",
					id: mediaStream.connector.roomid
				})

			};

			$scope.setRoomStatus = function(status) {
				if (status !== $scope.enabled) {
					$scope.enabled = status;
					$scope.$emit("roomStatus", status);
				}
				if (status && !$scope.layout.buddylistAutoHide) {
					$scope.layout.buddylist = true
				}
			};

			//XXX(longsleep): Debug leftover ?? Remove this.
			window.doAudioConference = $scope.doAudioConference;

			var buddylist = $scope.buddylist = buddyList.buddylist($element, $scope, {});
			var onJoined = _.bind(buddylist.onJoined, buddylist);
			var onLeft = _.bind(buddylist.onLeft, buddylist);
			var onStatus = _.bind(buddylist.onStatus, buddylist);
			mediaStream.api.e.on("received.userleftorjoined", function(event, dataType, data) {
				if (dataType === "Left") {
					onLeft(data);
				} else {
					onJoined(data);
				}
			});
			mediaStream.api.e.on("received.users", function(event, data) {
				$scope.setRoomStatus(true);
				var selfId = $scope.id;
				_.each(data, function(p) {
					if (p.Id !== selfId) {
						onJoined(p);
					}
				});
				$scope.$apply();
			});
			mediaStream.api.e.on("received.status", function(event, data) {
				onStatus(data);
			});
			mediaStream.connector.e.on("closed error", function() {
				$scope.setRoomStatus(false);
				buddylist.onClosed();
			});

			// Request user list whenever the connection comes ready.
			mediaStream.connector.ready(function() {
				mediaStream.api.requestUsers();
			});

		}];

		var link = function(scope, iElement, iAttrs, controller) {

			// Add events to buddy list parent container to show/hide.
			var parent = iElement.parent();
			parent.on("mouseenter mouseleave", function(event) {
				if (event.type === "mouseenter") {
					scope.layout.buddylist = true;
				} else {
					if (scope.layout.buddylistAutoHide) {
						scope.layout.buddylist = false;
					}
				}
				scope.$apply();
			});

		};

		return {
			restrict: 'E',
			replace: true,
			scope: true,
			template: template,
			controller: controller,
			link: link
		}

	}];

});
