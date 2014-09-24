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
define(['angular', 'jquery', 'text!partials/buddycondensed.html', 'hoverIntent'], function(angular, $, template) {

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
			$scope.call = function(userid) {
				mediaStream.webrtc.doCall(getContactSessionId(userid));
			};
			$scope.chat = function(userid) {
				$scope.$emit("startchat", getContactSessionId(userid), {
					autofocus: true,
					restore: true
				});
			};
			$scope.listDefault = function() {
				if (buddycondensed.length >= $scope.maxBuddiesToShow) {
					return buddycondensed.slice(0, $scope.maxBuddiesToShow);
				} else {
					return buddycondensed;
				}
			};
			$scope.listOverDefault = function() {
				if (buddycondensed.length >= $scope.maxBuddiesToShow) {
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

		var link = function($scope, elem, attrs, ctrl) {
			var overDefaultDisplayNum = elem.find(".overDefaultDisplayNum");
			var desc = elem.find(".desc");
			var aboveElem1 = false;
			var aboveElem2 = false;
			var outMoreBuddy = function(event) {
				//console.log('out', event.currentTarget.className);
				if (event.currentTarget === desc.get(0)) {
					aboveElem1 = false;
				} else if (event.currentTarget === overDefaultDisplayNum.get(0)) {
					aboveElem2 = false;
				}
				if (!aboveElem1 && !aboveElem2) {
					overDefaultDisplayNum.hide();
				}
			};
			var overMoreBuddy = function(event) {
				//console.log('out', event.currentTarget.className);
				if (event.currentTarget === desc.get(0)) {
					aboveElem1 = true;
				} else if (event.currentTarget === overDefaultDisplayNum.get(0)) {
					aboveElem2 = true;
				}
				overDefaultDisplayNum.show();
			};
			elem.hoverIntent({
				over: overMoreBuddy,
				out: outMoreBuddy,
				timeout: 1000,
				selector: '.desc, .overDefaultDisplayNum'
			});
			var overBuddyPicture = function(event) {
				//console.log('overBuddyPicture', event.currentTarget.className);
				$(event.currentTarget).find(".actions").css("display", "inline-block");
			};
			var outBuddyPicture = function(event) {
				//console.log('outBuddyPicture', event.currentTarget.className);
				$(event.currentTarget).find(".actions").css("display", "none");
			};
			elem.hoverIntent({
				over: overBuddyPicture,
				out: outBuddyPicture,
				timeout: 100,
				selector: '.buddyPicture'
			});
		};

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
