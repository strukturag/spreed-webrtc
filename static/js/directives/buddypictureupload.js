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
			$scope.previewUpload = false;

			$scope.handleUpload = function(event) {
				var file = event.target.files[0];
				console.log('file', file);

				if(!file.type.match(/image/)) {
					error({event: {target: {error: {name: 'NotImage'}}}});
				}

				var reader = new FileReader();
				reader.readAsArrayBuffer(file);

				var progress = function(event) {
					console.log('file progress', event);
				};
				var load = function(event) {
					console.log('file load', event);
					var fileBuffer = event.target.result;
					// var context = $scope.uploadPrev.getContext('2d');
					// context.putImageData(fileBuffer, 0, 0);
					// $scope.previewUpload = true;
				};
				var error = function(event) {
					console.log('file error', event);
					if(event.target.error.name == 'NotReadableError') {
						// file couldn't be read
					}
					if(event.target.error.name == 'NotImage') {
						// file is not an image
					}
				};

				reader.onprogress = progress;
				reader.onload = load;
				reader.onerror = error;
			};

		}];

		var link = function($scope, $element) {

			$element.find("#uploadFile").on('change', $scope.handleUpload);
			$scope.uploadPrev = $element.find("canvas.uploadPrev").get(0);
			$($scope.uploadPrev).attr($scope.captureSize);

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
