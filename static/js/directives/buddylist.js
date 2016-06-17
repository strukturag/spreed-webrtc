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
define(['underscore', 'text!partials/buddylist.html'], function(_, template) {

	// buddyList
	return ["buddyList", "api", "webrtc", "contacts", function(buddyList, api, webrtc, contacts) {

		//console.log("buddyList directive");

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var buddylist = $scope.buddylist = buddyList.buddylist($element, $scope, {});
			var onJoined = _.bind(buddylist.onJoined, buddylist);
			var onLeft = _.bind(buddylist.onLeft, buddylist);
			var onStatus = _.bind(buddylist.onStatus, buddylist);
			var onContactAdded = _.bind(buddylist.onContactAdded, buddylist);
			var onContactRemoved = _.bind(buddylist.onContactRemoved, buddylist);
			var onContactUpdated = _.bind(buddylist.onContactUpdated, buddylist);

			var inRoom = false;

			$scope.layout.buddylist = false;
			$scope.layout.buddylistAutoHide = true;

			var updateBuddyListVisibility = function() {
				if (inRoom && !$scope.peer) {
					$scope.layout.buddylist = true;
					$scope.layout.buddylistAutoHide = false;
				} else if (!$scope.layout.buddylistAutoHide) {
					$scope.layout.buddylist = false;
					$scope.layout.buddylistAutoHide = true;
				}
			};

			webrtc.e.on("done", function() {
				$scope.$apply(updateBuddyListVisibility);
			});

			$scope.$watch("peer", function() {
				if ($scope.peer) {
					// Also reset the buddylist if the peer is cleared after the "done" event.
					updateBuddyListVisibility();
				}
			});

			$scope.$on("room.joined", function(ev) {
				inRoom = true;
				updateBuddyListVisibility();
			});

			$scope.$on("room.left", function(ev) {
				inRoom = false;
				buddylist.onClosed();
				updateBuddyListVisibility();
			});

			$scope.doCall = function(id) {
				webrtc.doCall(id);
			};

			$scope.doChat = function(id) {

				//console.log("doChat", id);
				$scope.$emit("startchat", id, {
					autofocus: true,
					restore: true
				});

			};

			$scope.doContactRequest = function(id) {

				//console.log("doContact", id);
				$scope.$emit("requestcontact", id, {
					restore: true
				});

			};

			$scope.doContactRemove = function(userid) {

				contacts.remove(userid);

			};

			api.e.on("received.userleftorjoined", function(event, dataType, data) {
				if (dataType === "Left") {
					onLeft(data);
				} else {
					onJoined(data);
				}
			});
			api.e.on("received.users", function(event, data) {
				var selfId = $scope.id;
				_.each(data, function(p) {
					if (p.Id !== selfId) {
						onJoined(p);
					}
				});
				$scope.$apply();
			});
			api.e.on("received.status", function(event, data) {
				onStatus(data);
			});

			// Contacts.
			contacts.e.on("contactadded", function(event, data) {
				onContactAdded(data);
			});
			contacts.e.on("contactremoved", function(event, data) {
				onContactRemoved(data);
			});
			contacts.e.on("contactupdated", function(event, data) {
				onContactUpdated(data);
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
			if (contacts.enabled) {
				iElement.addClass("with-contacts");
			}

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
