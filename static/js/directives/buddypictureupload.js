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
define(['jquery', 'underscore', 'text!partials/buddypictureupload.html'], function($, _, template) {

	// buddyPictureUpload
	return ["$compile", function($compile) {

		var controller = ['$scope', 'safeApply', '$timeout', '$q', function($scope, safeApply, $timeout, $q) {

			$scope.showUploadPicture = false;

		}];

		var link = function($scope, $element) {

			$scope.canvasUpload = $element.find("canvas.uploadPrev").get(0);
			$($scope.canvasUpload).attr($scope.captureSize);

		};

		return {
			restrict: 'E',
			transclude: true,
			replace: true,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
