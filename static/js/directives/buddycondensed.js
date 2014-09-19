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
define(['angular', 'text!partials/buddycondensed.html'], function(angular, template) {

	// buddycondensed
	return ["mediaStream", function(mediaStream) {

		var controller = ['$scope', '$element', 'mediaStream', 'buddyList', 'buddyPicture', 'contacts', function($scope, $element, mediaStream, buddyList, buddyPicture, contacts) {
			var buddycondensed = [];
			var joined = function(buddy) {
				buddycondensed.push(buddy);
			};
			var left = function(id) {
				for (var i in buddycondensed) {
					if(buddycondensed[i].Id === id) {
						buddycondensed.splice(i,1);
						break;
					}
				}
				$scope.$apply();
			};
			var contactadded = function(data) {
				// replace session data with contact data
				console.log('contactadded', data);
				var hasSession = false;
				for (var i in buddycondensed) {
					if(buddycondensed[i].Userid === data.Userid) {
						buddycondensed[i] = angular.extend(buddycondensed[i], data);
						hasSession = true;
						break;
					}
				}
				if(!hasSession) {
					joined(data);
				}
				$scope.$apply();
			};
			$scope.list = function() {
				return buddycondensed;
			};
			$scope.maxBuddiesToShow = 5;
			contacts.e.on("contactadded", function(event, data) {
				contactadded(data);
			});
			mediaStream.api.e.on("received.userleftorjoined", function(event, dataType, data) {
				console.log("received.userleftorjoined", data.Id);
				if (dataType === "Left") {
					left(data.Id);
				} else {
					joined(data);
				}
			});
			mediaStream.api.e.on("received.users", function(event, data) {
				console.log("received.users", data);
				var selfId = $scope.id;
				data.forEach(function(x) {
					if (x.Id !== selfId) {
						joined(x);
					}
				});
				$scope.$apply();
			});
		}];

		var link = function($scope, elem, attrs, ctrl) {};

		return {
			restrict: 'E',
			scope: true,
			replace: true,
			link: link,
			controller: controller,
			template: template
		};

	}];

});
