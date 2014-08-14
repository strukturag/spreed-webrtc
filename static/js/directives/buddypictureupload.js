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

		var controller = ['$scope', 'safeApply', '$timeout', '$q', 'translation', function($scope, safeApply, $timeout, $q, translation) {

			var previewWidth = 198;
			var previewHeight = 198;
			$scope.showUploadPicture = false;
			$scope.previewUpload = false;
			$scope.imgData = null;
			$scope.error = {
				msg: null
			};
			$scope.text = {
				initial: 'Please choose a picture to upload',
				again: 'Upload a different picture'
			};

			var setUploadImageDimension = function(data) {
				var img = new Image();
				img.onload = function() {
					if(this.width < previewWidth && this.height < previewHeight) {
						$scope.prevImage.style.height = null;
						$scope.prevImage.style.width = null;
						return;
					}
					if (this.width < this.height) {
						$scope.prevImage.style.width = previewWidth + 'px';
						$scope.prevImage.style.height = null;
						console.log('changed width');
					} else {
						$scope.prevImage.style.height = previewHeight + 'px';
						$scope.prevImage.style.width = null;
						console.log('changed height');
					}
				};
				img.src = data;
			};

			$scope.reset = function() {
				$scope.showUploadPicture = false;
				$scope.previewUpload = false;
			};

			$scope.handleUpload = function(event) {
				var file = event.target.files[0];
				if(!file) {
					return;
				}
				console.log('file', file);

				var progress = function(event) {
					console.log('file progress', event);
				};
				var load = function(event) {
					console.log('file load', event);
					$scope.$apply(function(scope) {
						scope.imgData = event.target.result;
						setUploadImageDimension(scope.imgData);
						$scope.previewUpload = true;
					});
				};
				var error = function(event) {
					console.log('file error', event);
					if(event.target.error.name == 'NotReadableError') {
						$scope.$apply(function(scope) {
							scope.error.msg = "The file couldn't be read";
						});
					}
					if(event.target.error.name == 'NotImage') {
						$scope.$apply(function(scope) {
							scope.error.msg = "The file is not an image.";
						});
					}
				};

				if(!file.type.match(/image/)) {
					error({target: {error: {name: 'NotImage'}}});
				} else {
					var reader = new FileReader();
					reader.readAsDataURL(file);

					reader.onprogress = progress;
					reader.onload = load;
					reader.onerror = error;
				}
			};

			$scope.usePicture = function() {
				$scope.writeToCanvas($scope.canvasPic, $scope.prevImage);
				$scope.user.buddyPicture = $scope.canvasPic.toDataURL("image/jpeg");
				$scope.reset();
				safeApply($scope);
			};

		}];

		var link = function($scope, $element) {
			$scope.prevImage = $(".showUploadPicture .preview").get(0);
			$element.find("#uploadFile").on('change', $scope.handleUpload);
			$scope.uploadPrev = $element.find("canvas.uploadPrev").get(0);
			$($scope.uploadPrev).attr($scope.captureSize);
		};

		return {
			restrict: 'E',
			transclude: true,
			replace: false,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
