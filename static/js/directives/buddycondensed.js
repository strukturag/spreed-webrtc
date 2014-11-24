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
define(['jquery', 'text!partials/buddycondensed.html'], function($, template) {

	// buddycondensed
	return [function() {

		var controller = ['$scope', 'mediaStream', 'contacts', 'buddyData', function($scope, mediaStream, contacts, buddyData) {
			var buddycondensed = [];
			var getContactSessionId = function(userid) {
				var session = null;
				var scope = buddyData.lookup(userid, false, false);
				if (scope) {
					session = scope.session.get();
				}
				return session && session.Id ? session.Id : null;
			};
			var empty = function(x) {
				return x === null || x === undefined || x === "";
			};
			var sortCondensed = function() {
				buddycondensed.sort(function(current, next) {
					if (!current.Status || current.Status && empty(current.Status.displayName)) {
						return 1;
					} else {
						if (next.Status && !empty(next.Status.displayName)) {
							if (current.Status.displayName < next.Status.displayName) {
								return -1;
							} else if (current.Status.displayName > next.Status.displayName) {
								return 1;
							} else {
								return 0;
							}
						} else {
							return 0;
						}
					}
				});
			};
			var joined = function(buddy) {
				buddycondensed.push(buddy);
			};
			var left = function(id) {
				for (var i in buddycondensed) {
					if (buddycondensed[i].Id === id) {
						buddycondensed.splice(i,1);
						break;
					}
				}
				$scope.$apply();
			};
			var contactadded = function(data) {
				//console.log('contactadded', data);
				var hasSession = false;
				for (var i in buddycondensed) {
					// replace session data with contact data
					if (buddycondensed[i].Userid === data.Userid) {
						buddycondensed[i] = data;
						hasSession = true;
						break;
					}
				}
				if (!hasSession) {
					joined(data);
				}
				$scope.$apply();
			};
			$scope.doCall = function(buddy) {
				mediaStream.webrtc.doCall(getContactSessionId(buddy.Userid));
			};
			$scope.doChat = function(buddy) {
				$scope.$emit("startchat", getContactSessionId(buddy.Userid), {
					autofocus: true,
					restore: true
				});
			};
			$scope.listDefault = function() {
				if (buddycondensed.length > $scope.maxBuddiesToShow) {
					return buddycondensed.slice(0, $scope.maxBuddiesToShow);
				} else {
					return buddycondensed;
				}
			};
			$scope.listOverDefault = function() {
				if (buddycondensed.length > $scope.maxBuddiesToShow) {
					return buddycondensed.slice($scope.maxBuddiesToShow);
				} else {
					return [];
				}
			};
			$scope.maxBuddiesToShow = 5;
			contacts.e.on("contactadded", function(event, data) {
				contactadded(data);
				sortCondensed();
			});
			mediaStream.api.e.on("received.userleftorjoined", function(event, dataType, data) {
				//console.log("received.userleftorjoined", data.Id);
				if (dataType === "Left") {
					left(data.Id);
				} else {
					joined(data);
				}
				sortCondensed();
			});
			mediaStream.api.e.on("received.users", function(event, data) {
				//console.log("received.users", data);
				var selfId = $scope.id;
				data.forEach(function(x) {
					if (x.Id !== selfId) {
						joined(x);
					}
				});
				sortCondensed();
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
