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
define(['jquery', 'underscore', 'text!partials/buddypictureupload.html', 'bootstrap-file-input'], function($, _, template, BootstrapFileInput) {

	// buddyPictureUpload
	return ["$compile", function($compile) {

		var controller = ['$scope', 'safeApply', '$timeout', '$q', 'translation', function($scope, safeApply, $timeout, $q, translation) {

			var previewWidth = 205;
			var previewHeight = 205;
			$scope.maxUploadMb = 8;
			var maxUploadBytes = $scope.maxUploadMb * 1024 * 1024;
			$scope.showUploadPicture = false;
			$scope.previewUpload = false;
			$scope.imgData = null;
			$scope.error = {
				read: null,
				image: null,
				size: null
			};
			$scope.upload = {
				status: 0
			};

			var completedUpload = function() {
				$scope.upload.status = 100;
			};

			var setUploadImageDimension = function(data) {
				$scope.prevImage.onload = function() {
					// clear old dimensions
					this.style.cssText = null;
					// get new dimensions
					var dim = getAutoFitDimensions(this, {width: previewWidth, height: previewHeight});
					this.style.width = dim.width + 'px';
					this.style.height = dim.height + 'px';
					this.style.top = '0px';
					this.style.left = '0px';
					completedUpload();
					safeApply($scope);
				};
				$scope.prevImage.src = data;
			};

			var getNumFromPx = function(px) {
				return px.match(/[\-0-9]+/) ? Number(px.match(/[\-0-9]+/)[0]) : 0;
			};

			// Auto fit by smallest dimension
			var getAutoFitDimensions = function(from, to) {
				if (!from.width && !from.height && !to.width && !to.height) {
					return null;
				}
				var width = null;
				var height = null;

				if (from.width < from.height) {
					height = to.width * (from.height/from.width);
					width = to.width;
				} else {
					height = to.height;
					width = to.height * (from.width/from.height);
				}
				return {width: width, height: height};
			};

			// (image, canvas) -> object
			var getScaledDimensions = function(from, to) {
				if (!from.style.width && !from.style.height && !to.width && !to.height) {
					return null;
				}
				var current = {
					width: getNumFromPx(from.style.width),
					height: getNumFromPx(from.style.height),
					top: getNumFromPx(from.style.top),
					left: getNumFromPx(from.style.left)
				};
				var scaleFactorX = previewWidth / to.width;
				var scaleFactorY = previewHeight / to.height;
				var width = current.width / scaleFactorX;
				var height = current.height / scaleFactorY;
				var x = current.left / scaleFactorX;
				var y = current.top / scaleFactorY;
				if (current.width < previewWidth) {
					x = ((previewWidth - current.width) / scaleFactorX ) / 2;
				}
				if (current.height < previewHeight) {
					y = ((previewHeight - current.height) / scaleFactorY ) / 2;
				}

				return {width: width, height: height, x: x, y: y};
			};

			var writeUploadToCanvas = function(canvas, img) {
				var dim = getScaledDimensions(img, canvas);
				var context = canvas.getContext("2d");
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.drawImage(img, dim.x, dim.y, dim.width, dim.height);
				//console.log('writeUploadToCanvas', dim);
			};

			$scope.usePicture = function() {
				writeUploadToCanvas($scope.canvasPic, $scope.prevImage);
				$scope.user.buddyPicture = $scope.canvasPic.toDataURL("image/jpeg");
				$scope.reset();
				safeApply($scope);
			};

			$scope.reset = function() {
				$scope.showUploadPicture = false;
				$scope.previewUpload = false;
			};

			$scope.handleUpload = function(event) {
				var file = event.target.files[0];
				if (!file) {
					return;
				}
				//console.log('file', file);
				var progress = function(event) {
					//console.log('file progress', event);
					var percentComplete = event.loaded/event.total * 100;
					// show complete only when src is loaded in image element
					if(percentComplete != 100) {
						$scope.$apply(function(scope) {
							$scope.upload.status = percentComplete;
						});
					}
				};
				var load = function(event) {
					//console.log('file load', event);
					$scope.$apply(function(scope) {
						scope.imgData = event.target.result;
						setUploadImageDimension(scope.imgData);
						$scope.previewUpload = true;
					});
				};
				var error = function(event) {
					//console.log('file error', event);
					if (event.target.error.name == 'NotReadableError') {
						$scope.$apply(function(scope) {
							scope.error.read = true;
						});
					}
					if (event.target.error.name == 'NotImage') {
						$scope.$apply(function(scope) {
							scope.error.image = true;
						});
					}
					if (event.target.error.name == 'Size') {
						$scope.$apply(function(scope) {
							scope.error.size = true;
						});
					}
				};

				if (!file.type.match(/image/)) {
					error({target: {error: {name: 'NotImage'}}});
				} else if (file.size > maxUploadBytes) {
					error({target: {error: {name: 'Size'}}});
				} else {
					$scope.$apply(function(scope) {
						$scope.upload.status = 5;
					});
					var reader = new FileReader();
					reader.readAsDataURL(file);

					reader.onprogress = progress;
					reader.onload = load;
					reader.onerror = error;
				}
			};

		}];

		var link = function($scope, $element) {
			$scope.prevImage = $(".showUploadPicture .preview").get(0);
			$element.find("#uploadFile").on('change', $scope.handleUpload);

			var intervalNum = {
				num: null
			};

			var incrementPx = function(num) {
				return ((Number(num.match(/[\-0-9]+/)) + 5) + 'px');
			};
			var decrementPx = function(num) {
				return ((Number(num.match(/[\-0-9]+/)) - 5) + 'px');
			};
			var moveImageUp = function() {
				$scope.prevImage.style.top = decrementPx($scope.prevImage.style.top);
			};
			var moveImageDown = function() {
				$scope.prevImage.style.top = incrementPx($scope.prevImage.style.top);
			};
			var moveImageLeft = function() {
				$scope.prevImage.style.left = decrementPx($scope.prevImage.style.left);
			};
			var moveImageRight = function() {
				$scope.prevImage.style.left = incrementPx($scope.prevImage.style.left);
			};
			var makeImageLarger = function() {
				$scope.prevImage.style.height = incrementPx($scope.prevImage.style.height);
				$scope.prevImage.style.width = incrementPx($scope.prevImage.style.width);
			};
			var makeImageSmaller = function() {
				$scope.prevImage.style.height = decrementPx($scope.prevImage.style.height);
				$scope.prevImage.style.width = decrementPx($scope.prevImage.style.width);
			};
			var changeImage = function(evt) {
				if (evt.data.intervalNum.num || !evt.data.action) {
					clearInterval(evt.data.intervalNum.num);
					evt.data.intervalNum.num = null;
				} else {
					evt.data.intervalNum.num = setInterval(function() {
						evt.data.action();
					}, 50);
				}
			};

			$element.find("#arrow-up").on('mousedown', null, {intervalNum: intervalNum, action: moveImageUp}, changeImage);
			$element.find("#arrow-down").on('mousedown', null, {intervalNum: intervalNum, action: moveImageDown}, changeImage);
			$element.find("#arrow-up").on('mouseup', null, {intervalNum: intervalNum}, changeImage);
			$element.find("#arrow-down").on('mouseup', null, {intervalNum: intervalNum}, changeImage);

			$element.find("#arrow-left").on('mousedown', null, {intervalNum: intervalNum, action: moveImageLeft}, changeImage);
			$element.find("#arrow-right").on('mousedown', null, {intervalNum: intervalNum, action: moveImageRight}, changeImage);
			$element.find("#arrow-left").on('mouseup', null, {intervalNum: intervalNum}, changeImage);
			$element.find("#arrow-right").on('mouseup', null, {intervalNum: intervalNum}, changeImage);

			$element.find("#larger").on('mousedown', null, {intervalNum: intervalNum, action: makeImageLarger}, changeImage);
			$element.find("#smaller").on('mousedown', null, {intervalNum: intervalNum, action: makeImageSmaller}, changeImage);
			$element.find("#larger").on('mouseup', null, {intervalNum: intervalNum}, changeImage);
			$element.find("#smaller").on('mouseup', null, {intervalNum: intervalNum}, changeImage);

			// Give translation time to transform title text of [input=file] instances before bootstrap.file-input parses dom.
			setTimeout(function() {
				$('#uploadFile').bootstrapFileInput();
			}, 0);
		};

		return {
			restrict: 'E',
			replace: false,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
