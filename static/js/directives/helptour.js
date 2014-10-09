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
				outStep();
				$scope.tourPaused = false;
				$scope.currentIndex = null;
			};
			var outStep = function() {
				$($scope.steps[$scope.currentIndex]).removeClass('in');
			};
			var inStep = function(i, elem) {
				$scope.currentIndex = i;
				$($scope.steps[i]).addClass('in');
			};
			var autoStep = function(i, elem) {
				timeoutAutoStepsIn[i] = $timeout(function() {
					inStep(i);
				}, displayTime * i, true);
				timeoutAutoStepsOut[i] = $timeout(function() {
					outStep(i);
					if ($scope.steps.length === i + 1) {
						$scope.togglePause();
					}
				}, displayTime * (i + 1), true);
			};
			var autoTour = function(startIndex) {
				// start again from the beginning
				if (startIndex === undefined || startIndex === $scope.steps.length - 1) {
					startIndex = 0;
				}
				$scope.steps.each(function(i, x) {
					if (i >= startIndex) {
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
				if (!$scope.tourPaused) {
					$scope.togglePause();
				}
				outStep();
				inStep(0);
			};
			$scope.stepBackward = function() {
				if (!$scope.tourPaused) {
					$scope.togglePause();
				}
				outStep();
				inStep($scope.currentIndex - 1);
			};
			$scope.stepForward = function() {
				if (!$scope.tourPaused) {
					$scope.togglePause();
				}
				outStep();
				inStep($scope.currentIndex + 1);
			};
			$scope.stepEnd = function() {
				if (!$scope.tourPaused) {
					$scope.togglePause();
				}
				outStep();
				inStep($scope.steps.length - 1);
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
				if (!$scope.tourPaused) {
					manualTour();
				}
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
