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

define(['jquery', 'text!partials/helpoverlay.html', 'text!partials/helptour.html'], function($, template, templatehelptour) {

	//helptour
	return [function() {

		var controller = ['$scope', '$timeout', '$modal', 'userSettingsData', '$q', function($scope, $timeout, $modal, userSettingsData, $q) {
			var displayTime = 2000;
			var shown = localStorage.getItem('mediastream-helptour');
			var timeoutAutoStepsIn = [];
			var timeoutAutoStepsOut = [];
			var reset = function() {
				$scope.toAutourPaused = false;
				$($scope.steps[$scope.currentIndex]).removeClass('in');
				$scope.currentIndex = null;
			};
			var outStep = function(i, elem) {
				$(elem).removeClass('in');
			};
			var inStep = function(i, elem) {
				$(elem).addClass('in');
				$scope.currentIndex = i;
			};
			var autoStep = function(i, elem) {
				timeoutAutoStepsIn[i] = $timeout(function() {
					inStep(i, elem);
				}, displayTime * i, true);
				timeoutAutoStepsOut[i] = $timeout(function() {
					outStep(i, elem);
				}, displayTime * (i + 1), true);
			};
			var autoTour = function(start) {
				start = start ? start - 1 : 0;
				$scope.steps.each(function(i, x) {
					if(i >= start) {
						autoStep(i, x);
					}
				});
			};
			var manualTour = function() {
				timeoutAutoStepsIn.forEach(function(promise) {
					$timeout.cancel(promise);
				});
				timeoutAutoStepsOut.forEach(function(promise) {
					$timeout.cancel(promise);
				});
			};
			var introTour = function() {
				$scope.layout.settings = false;
				var controller = ['$scope', '$modalInstance', function(scope, $modalInstance) {
					scope.goTour = function() {
						$modalInstance.dismiss();
						autoTour();
					};
				}];
				$modal.open({
					template: templatehelptour,
					controller: controller,
					size: 'sm'
				});
			};
			if (!shown) {
				introTour();
				localStorage.setItem('mediastream-helptour', true);
			}
			$scope.tourPaused = false;
			$scope.currentIndex = null;
			$scope.stepBeginning = function() {
				outStep($scope.currentIndex, $scope.steps[$scope.currentIndex]);
				inStep(0, $scope.steps[0]);
			};
			$scope.stepBackward = function() {
				outStep($scope.currentIndex, $scope.steps[$scope.currentIndex]);
				inStep($scope.currentIndex - 1, $scope.steps[$scope.currentIndex - 1]);
			};
			$scope.stepForward = function() {
				outStep($scope.currentIndex, $scope.steps[$scope.currentIndex]);
				inStep($scope.currentIndex + 1, $scope.steps[$scope.currentIndex + 1]);
			};
			$scope.stepEnd = function() {
				outStep($scope.currentIndex, $scope.steps[$scope.currentIndex]);
				inStep($scope.steps.length - 1, $scope.steps[$scope.steps.length - 1]);
			};
			$scope.togglePause = function() {
				$scope.tourPaused = !$scope.tourPaused;
				if ($scope.tourPaused) {
					manualTour();
				} else {
					autoTour($scope.currentIndex);
				}
			};
			$scope.exitTour = function() {
				manualTour();
				reset();
			};
			$scope.$on('showHelpTour', function() {
				introTour();
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
