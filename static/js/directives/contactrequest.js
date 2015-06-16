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

	return ["translation", "buddyData", "contacts", function(translation, buddyData, contacts) {

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			$scope.state = "request";
			$scope.doAccept = function() {
				$scope.state = "accepted";
				$scope.doContact(true);
			};

			$scope.doReject = function() {
				$scope.state = "rejected";
				$scope.doContact(false);
			};

			$scope.doContact = function(success) {
				var r = $scope.request;
				r.Success = !!success;
				$scope.sendChatServer($scope.id, "Contact request answer", {
					ContactRequest: r
				});
			};

			$scope.addContact = function(request, status) {
				contacts.add(request, status)
			};

			// Add support for contacts on controller creation.
			var request = $scope.request;
			if (request.Success && request.Userid && request.Token) {
				var buddy = buddyData.lookup($scope.id);
				var status = {};
				if (buddy) {
					$.extend(status, buddy.status);
				}
				$scope.addContact(request, status);
			}

		}];

		return {
			scope: true,
			restrict: 'EAC',
			controller: controller,
			replace: false
		}

	}];

});
