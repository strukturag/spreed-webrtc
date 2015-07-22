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

"use strict";
define(['jquery', 'angular', 'text!partials/helpoverlay.html', 'text!partials/helptourstart.html', 'text!partials/helptourend.html'], function($, angular, template, templatehelptourstart, templatehelptourend) {

	//helptour
	return [function() {

		var controller = ['$scope', '$timeout', '$modal', '$rootScope', function($scope, $timeout, $modal, $rootScope) {
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
			var tourLayoutShowOptionsPane = {
				buddylist: false,
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
			var initRoomLayout = function() {
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
			menus.toggleOptions = function() {
				$scope.layout = angular.extend($scope.layout, tourLayoutShowOptionsPane);
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
						initRoomLayout();
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
			var startTour = function() {
				if ($scope.currentIndex === $scope.steps.length - 1 && isToggled) {
					outStep();
					$scope.currentIndex = 0;
				}
				inStep(0);
			};
			var initTour = function() {
				backupLayout = angular.extend({}, $scope.layout);
				initRoomLayout();
				startTour();
			};
			var reset = function() {
				if (isToggled) {
					outStep();
				}
				$scope.currentIndex = null;
				$scope.layout = angular.extend($scope.layout, backupLayout);
				isToggled = false;
			};
			var introTourSlide = function() {
				var controller = ['$scope', '$modalInstance', function(scope, $modalInstance) {
					scope.goTour = function() {
						$modalInstance.dismiss();
						initTour();
					};
				}];
				$modal.open({
					template: templatehelptourstart,
					controller: controller,
					size: 'md'
				});
			};
			$scope.endTourSlide = function() {
				outStep();
				var controller = ['$scope', '$modalInstance', function(scope, $modalInstance) {
					scope.goTour = function() {
						$modalInstance.dismiss();
						startTour();
					};
					scope.endTour = function() {
						$modalInstance.dismiss();
						reset();
					};
				}];
				$modal.open({
					template: templatehelptourend,
					controller: controller,
					size: 'md'
				});
			};
			$scope.currentIndex = null;
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
			$scope.$on('showHelpTourStart', function() {
				introTourSlide();
			});
			$rootScope.$on("rooms.ready", function(event, room) {
				if (!shown) {
					introTourSlide();
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
