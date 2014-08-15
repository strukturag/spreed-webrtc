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

			var previewWidth = 200;
			var previewHeight = 200;
			$scope.moveHorizontal = false;
			$scope.moveVertical = false;
			$scope.showUploadPicture = false;
			$scope.previewUpload = false;
			$scope.imgData = null;
			$scope.showEditTools = false;
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
					var dim = getAutoFitDimensions(this, {width: previewWidth, height: previewHeight});
					$scope.prevImage.style.width = dim.width + 'px';
					$scope.prevImage.style.height = dim.height + 'px';
					$scope.prevImage.style.top = '0px';
					$scope.prevImage.style.left = '0px';
					safeApply($scope);
				};
				img.src = data;
			};

			var handleImageDrag = function(evt) {
				evt.preventDefault();
				console.log('draggin image', evt.offsetX, evt.offsetY);
			};
			var handleImageDrop = function(evt) {
				evt.preventDefault();
				console.log('dropped image', evt);
			};
			$scope.addImageMoveHandlers = function() {
				$scope.prevImage.addEventListener('dragover', handleImageDrag);
				$scope.prevImage.addEventListener('drop', handleImageDrop);
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

			var getNumFromPx = function(px) {
				return px.match(/[\-0-9]+/) ? Number(px.match(/[\-0-9]+/)[0]) : 0;
			};

			// Auto fit by smallest dimension
			// (image, canvas) -> object
			var getAutoFitDimensions = function(from, to) {
				if(!from.width && !from.height && !to.width && !to.height) {
					return null;
				}
				var width = null;
				var height = null;
				var x = null;
				var y = null;
				var fromAspectRatio = 1;
				var scaleFactorX = 1;
				var scaleFactorY = 1;

				if (from.width < from.height) {
					fromAspectRatio = from.height/from.width;
					scaleFactorX = to.width/from.width;
					scaleFactorY = to.height/from.height;
					width = to.width;
					height = to.width * fromAspectRatio;
					x = scaleFactorX * getNumFromPx(from.style.left);
					y = (scaleFactorY * getNumFromPx(from.style.top)) * fromAspectRatio;
				} else {
					fromAspectRatio = from.width/from.height;
					scaleFactorX = to.width/from.width;
					scaleFactorY = to.height/from.height;
					width = to.height * fromAspectRatio;
					height = to.height;
					x = (scaleFactorX * getNumFromPx(from.style.left)) * fromAspectRatio;
					y = scaleFactorY * getNumFromPx(from.style.top);
				}

				return{width: width, height: height, x: x, y: y};
			};

			var writeUploadToCanvas = function(canvas, img) {
				var dim = getAutoFitDimensions(img, canvas);
				canvas.getContext("2d").drawImage(img, dim.x, dim.y, dim.width, dim.height);
				console.log('writeUploadToCanvas', dim);
			};

			$scope.usePicture = function() {
				writeUploadToCanvas($scope.canvasPic, $scope.prevImage);
				$scope.user.buddyPicture = $scope.canvasPic.toDataURL("image/jpeg");
				$scope.reset();
				safeApply($scope);
			};

		}];

		var link = function($scope, $element) {
			$scope.prevImage = $(".showUploadPicture .preview").get(0);
			$scope.addImageMoveHandlers();
			$element.find("#uploadFile").on('change', $scope.handleUpload);
			$scope.uploadPrev = $element.find("canvas.uploadPrev").get(0);
			$($scope.uploadPrev).attr($scope.captureSize);

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
			var moveImage = function(evt) {
				if(evt.data.intervalNum.num || !evt.data.action) {
					clearInterval(evt.data.intervalNum.num);
					evt.data.intervalNum.num = null;
				} else {
					evt.data.intervalNum.num = setInterval(function() {
						evt.data.action();
					}, 50);
				}
			};

			$element.find("#arrow-up").on('mousedown', null, {intervalNum: intervalNum, action: moveImageUp}, moveImage);
			$element.find("#arrow-down").on('mousedown', null, {intervalNum: intervalNum, action: moveImageDown}, moveImage);
			$element.find("#arrow-up").on('mouseup', null, {intervalNum: intervalNum}, moveImage);
			$element.find("#arrow-down").on('mouseup', null, {intervalNum: intervalNum}, moveImage);

			$element.find("#arrow-left").on('mousedown', null, {intervalNum: intervalNum, action: moveImageLeft}, moveImage);
			$element.find("#arrow-right").on('mousedown', null, {intervalNum: intervalNum, action: moveImageRight}, moveImage);
			$element.find("#arrow-left").on('mouseup', null, {intervalNum: intervalNum}, moveImage);
			$element.find("#arrow-right").on('mouseup', null, {intervalNum: intervalNum}, moveImage);
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
