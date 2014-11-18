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

define(['jquery', 'angular', 'text!partials/helpoverlay.html', 'text!partials/helptour.html'], function($, angular, template, templatehelptour) {

	//helptour
	return [function() {

		var controller = ['$scope', '$timeout', '$modal', '$rootScope', 'mediaStream', function($scope, $timeout, $modal, $rootScope, mediaStream) {
			var isToggled = false;
			var displayTime = 12000;
			var shown = localStorage.getItem('mediastream-helptour');
			var menus = {};
			var backupLayout = null;
			var tourLayout = {
				buddylist: true,
				buddylistAutoHide: false,
				chat: false,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: false,
				screenshare: false,
				settings: false
			};
			var tourLayoutShowRoomPane = {
				buddylist: true,
				buddylistAutoHide: false,
				chat: false,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: true,
				screenshare: false,
				settings: false
			};
			var tourLayoutShowBuddyListPane = {
				buddylist: true,
				buddylistAutoHide: false,
				chat: false,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: false,
				screenshare: false,
				settings: false
			};
			var tourLayoutShowChatPane = {
				buddylist: true,
				buddylistAutoHide: false,
				chat: true,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: false,
				screenshare: false,
				settings: false
			};
			var tourLayoutShowSettingsPane = {
				buddylist: false,
				buddylistAutoHide: false,
				chat: false,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: false,
				screenshare: false,
				settings: true
			};
			var tourLayoutShowMediaAccessPane = {
				buddylist: true,
				buddylistAutoHide: false,
				chat: false,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: false,
				screenshare: false,
				settings: false
			};
			var tourLayoutShowWelcomePane = {
				buddylist: true,
				buddylistAutoHide: false,
				chat: false,
				chatMaximized: false,
				main: null,
				presentation: false,
				roombar: false,
				screenshare: false,
				settings: false
			};
			menus.triggerMediaAccess = function() {
				if (isToggled) {
					mediaStream.webrtc.testMediaAccess(function() {});
				} else {
					mediaStream.webrtc.stop();
				}
			};
			menus.initRoomLayout = function() {
				$scope.layout = angular.extend($scope.layout, tourLayout);
			};
			menus.toggleRoom = function() {
				$scope.layout = angular.extend($scope.layout, tourLayoutShowRoomPane);
			};
			menus.toggleChat = function() {
				$scope.layout = angular.extend($scope.layout, tourLayoutShowChatPane);
			};
			menus.toggleSettings = function() {
				$scope.layout = angular.extend($scope.layout, tourLayoutShowSettingsPane);
			};
			menus.toggleCSS = function(css) {
				$('body').toggleClass(css);
			};
			var toggleTargetMenu = function() {
				var menu = $($scope.steps[$scope.currentIndex]).data('menu');
				var css = $($scope.steps[$scope.currentIndex]).data('css');
				if (menu) {
					isToggled = !isToggled;
					if(!isToggled) {
						menus.initRoomLayout();
					} else {
						menus[menu]();
					}
				}
				if (css) {
					menus.toggleCSS(css);
				}
			};
			var outStep = function() {
				toggleTargetMenu();
				$($scope.steps[$scope.currentIndex]).removeClass('in');
			};
			var inStep = function(i) {
				$scope.currentIndex = i;
				toggleTargetMenu();
				$($scope.steps[$scope.currentIndex]).addClass('in');
			};
			var initTour = function() {
				backupLayout = angular.extend({}, $scope.layout);
				menus.initRoomLayout();
				$scope.startTour();
			};
			var reset = function() {
				outStep();
				$scope.currentIndex = null;
				$scope.layout = angular.extend($scope.layout, backupLayout);
			};
			var introTour = function() {
				var controller = ['$scope', '$modalInstance', function(scope, $modalInstance) {
					scope.goTour = function() {
						$modalInstance.dismiss();
						initTour();
					};
				}];
				$modal.open({
					template: templatehelptour,
					controller: controller,
					size: 'sm'
				});
			};
			$scope.currentIndex = null;
			$scope.startTour = function() {
				if ($scope.currentIndex === $scope.steps.length - 1) {
					outStep();
					$scope.currentIndex = 0;
				}
				inStep(0);
			};
			$scope.stepBackward = function() {
				outStep();
				inStep($scope.currentIndex - 1);
			};
			$scope.stepForward = function() {
				outStep();
				inStep($scope.currentIndex + 1);
			};
			$scope.exitTour = function() {
				reset();
			};
			$scope.$on('showHelpTour', function() {
				introTour();
			});
			$rootScope.$on("room", function(event, room) {
				if (!shown) {
					introTour();
					localStorage.setItem('mediastream-helptour', 1);
				}
			});
		}];

		var link = function($scope, $elem, $attrs) {
			$scope.steps = $elem.find('.tourSteps .popover');
		};

		return {
			restrict: 'E',
			scope: true,
			replace: true,
			template: template,
			controller: controller,
			link: link
		};
	}];
});
