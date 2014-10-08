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

		var controller = ['$scope', '$rootScope', '$timeout', 'mediaStream', '$modal', function($scope, $rootScope, $timeout, mediaStream, $modal) {
			var displayTime = 500;
			var doStep = function(i, elem) {
				$timeout(function() {
					$(elem).addClass('in');
				}, displayTime * i, true);
				$timeout(function() {
					$(elem).removeClass('in');
				}, displayTime * (i + 1), true);
			};
			var startTour = function() {
				$scope.steps.each(function(i, x) {
					doStep(i, x);
				});
			};
			var introTour = function() {
				$scope.layout.settings = false;
				var controller = ['$scope', '$modalInstance', function($scope, $modalInstance) {
					$scope.goTour = function() {
						$modalInstance.dismiss();
						startTour();
					};
				}];
				$modal.open({
					template: templatehelptour,
					controller: controller,
					resolve: {},
					size: 'sm'
				});
			};
			introTour();
			$scope.$on('showHelpTour', function(current, last) {
				if(current) {
					introTour();
				}
			});
		}];

		var link = function($scope, $elem, $attrs) {
			$scope.steps = $elem.find('.popover');
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
