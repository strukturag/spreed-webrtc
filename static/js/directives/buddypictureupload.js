/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2015 struktur AG
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
define(['jquery', 'underscore', 'text!partials/buddypictureupload.html'], function($, _, template) {

	// buddyPictureUpload
	return ["$compile", function($compile) {

		var getNumFromPx = function(px) {
			var num = px.match(/[\-0-9]+/);
			if (num) {
				num = Number(num[0]);
			} else {
				num = 0;
			}
			return num;
		};

		var controller = ['$scope', 'safeApply', '$timeout', '$q', 'translation', function($scope, safeApply, $timeout, $q, translation) {

			var previewWidth = 205;
			var previewHeight = 205;
			var maxUploadBytes = 8388608; // 8MB

			var completedUpload;
			var setUploadImageDimension;
			var getAutoFitDimensions;
			var getScaledDimensions;
			var writePictureToCanvas;
			var clearPicture;

			$scope.maxUploadMb = maxUploadBytes / 1024 / 1024;
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
			$scope.aspectRatio = 1;

			completedUpload = function() {
				$scope.upload.status = 100;
			};

			setUploadImageDimension = function(data) {
				$scope.prevImage.onload = function() {
					// clear old dimensions
					this.style.cssText = null;
					$scope.aspectRatio = this.width/this.height;
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

			// Auto fit by smallest dimension
			getAutoFitDimensions = function(from, to) {
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
			getScaledDimensions = function(from, to) {
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

			writePictureToCanvas = function(canvas) {
				var img = $scope.prevImage;
				var dim = getScaledDimensions(img, canvas);
				var context = canvas.getContext("2d");
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.drawImage(img, dim.x, dim.y, dim.width, dim.height);
				//console.log('writeUploadToCanvas', dim);
			};

			clearPicture = function() {
				$(".file-input-name").empty();
				$scope.imgData = null;
				$scope.prevImage.src = "";
				$scope.prevImage.style.cssText = null;
				$scope.clearInput();
			};

			$scope.cancelPictureUpload = function() {
				$scope.showUploadPicture = false;
				$scope.previewUpload = false;
				clearPicture();
			};

			$scope.usePictureUpload = function() {
				writePictureToCanvas($scope.canvasPic);
				$scope.save();
				$scope.cancelPictureUpload();
			};

			$scope.handlePictureUpload = function(event) {
				var file = event.target.files[0];
				if (!file) {
					return;
				}
				//console.log('file', file);
				var progress = function(event) {
					//console.log('file progress', event);
					var percentComplete = event.loaded/event.total * 100;
					// show complete only when src is loaded in image element
					if (percentComplete !== 100) {
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

			$scope.prevImage = $element.find("img.preview")[0];
			$scope.clearInput = function() {
				$element.find("input[type=file]")[0].value = "";
			};

			// Bind change event of file upload form.
			$element.find("input[type=file]").on("change", $scope.handlePictureUpload);

			var intervalNum = {
				num: null
			};
			var pxDefaultMovementSpeed = 5;

			// Return the correct image height based on changes to the image width.
			var calcHeight = function(width) {
				return (getNumFromPx(width) / $scope.aspectRatio) + 'px';
			};
			var incrementPx = function(num, pxToMove) {
				if (pxToMove === undefined) {
					pxToMove = pxDefaultMovementSpeed;
				}
				return (getNumFromPx(num) + pxToMove) + 'px';
			};
			var decrementPx = function(num, pxToMove) {
				if (pxToMove === undefined) {
					pxToMove = pxDefaultMovementSpeed;
				}
				return (getNumFromPx(num) - pxToMove) + 'px';
			};
			var moveImageUp = function(pxMove) {
				$scope.prevImage.style.top = decrementPx($scope.prevImage.style.top, pxMove);
			};
			var moveImageDown = function(pxMove) {
				$scope.prevImage.style.top = incrementPx($scope.prevImage.style.top, pxMove);
			};
			var moveImageLeft = function(pxMove) {
				$scope.prevImage.style.left = decrementPx($scope.prevImage.style.left, pxMove);
			};
			var moveImageRight = function(pxMove) {
				$scope.prevImage.style.left = incrementPx($scope.prevImage.style.left, pxMove);
			};
			var makeImageLarger = function() {
				$scope.prevImage.style.width = incrementPx($scope.prevImage.style.width);
				$scope.prevImage.style.height = calcHeight($scope.prevImage.style.width);
				moveImageLeft(1);
				moveImageUp(2);
			};
			var makeImageSmaller = function() {
				$scope.prevImage.style.width = decrementPx($scope.prevImage.style.width);
				$scope.prevImage.style.height = calcHeight($scope.prevImage.style.width);
				moveImageRight(1);
				moveImageDown(2);
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

			$element.find(".fa-long-arrow-up").on('mousedown', null, {intervalNum: intervalNum, action: moveImageDown}, changeImage);
			$element.find(".fa-long-arrow-down").on('mousedown', null, {intervalNum: intervalNum, action: moveImageUp}, changeImage);
			$element.find(".fa-long-arrow-up").on('mouseup', null, {intervalNum: intervalNum}, changeImage);
			$element.find(".fa-long-arrow-down").on('mouseup', null, {intervalNum: intervalNum}, changeImage);

			$element.find(".fa-long-arrow-left").on('mousedown', null, {intervalNum: intervalNum, action: moveImageLeft}, changeImage);
			$element.find(".fa-long-arrow-right").on('mousedown', null, {intervalNum: intervalNum, action: moveImageRight}, changeImage);
			$element.find(".fa-long-arrow-left").on('mouseup', null, {intervalNum: intervalNum}, changeImage);
			$element.find(".fa-long-arrow-right").on('mouseup', null, {intervalNum: intervalNum}, changeImage);

			$element.find(".fa-plus").on('mousedown', null, {intervalNum: intervalNum, action: makeImageLarger}, changeImage);
			$element.find(".fa-minus").on('mousedown', null, {intervalNum: intervalNum, action: makeImageSmaller}, changeImage);
			$element.find(".fa-plus").on('mouseup', null, {intervalNum: intervalNum}, changeImage);
			$element.find(".fa-minus").on('mouseup', null, {intervalNum: intervalNum}, changeImage);

		};

		return {
			scope: false,
			restrict: 'E',
			require: '^buddyPictureCapture',
			replace: true,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
