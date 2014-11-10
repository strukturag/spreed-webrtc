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

	var getNumFromPx = function(px) {
		return px.match(/[\-0-9]+/) ? Number(px.match(/[\-0-9]+/)[0]) : 0;
	};

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
			$scope.aspectRatio = 1;

			var completedUpload = function() {
				$scope.upload.status = 100;
			};

			var setUploadImageDimension = function(data) {
				$scope.prevImage.onload = function() {
					// clear old dimensions
					this.style.cssText = $scope.dragImage.style.cssText = null;
					$scope.aspectRatio = this.width/this.height;
					// get new dimensions
					var dim = getAutoFitDimensions(this, {width: previewWidth, height: previewHeight});
					this.style.width = $scope.dragImage.style.width = dim.width + 'px';
					this.style.height = $scope.dragImage.style.height = dim.height + 'px';
					this.style.top = $scope.dragImage.style.top = '0px';
					this.style.left = $scope.dragImage.style.left = '0px';
					this.style.cursor = "move";
					completedUpload();
					safeApply($scope);
				};
				$scope.prevImage.src = $scope.dragImage.src = data;
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

			var writePictureToCanvas = function(canvas) {
				var img = $scope.prevImage;
				var dim = getScaledDimensions(img, canvas);
				var context = canvas.getContext("2d");
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.drawImage(img, dim.x, dim.y, dim.width, dim.height);
				//console.log('writeUploadToCanvas', dim);
			};

			var clearPicture = function() {
				$(".file-input-name").empty();
				$scope.imgData = null;
				$scope.prevImage.src = $scope.dragImage.src = "";
				$scope.prevImage.style.cssText = $scope.dragImage.style.cssText = null;
				$scope.prevImage.style.cursor = "auto";
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
			// Bind change event of file upload form.
			$element.find("input[type=file]").on("change", $scope.handlePictureUpload);
			$scope.prevImage = $(".showUploadPicture .preview").get(0);
			$scope.dragImage = $(".buddyPictureUpload .previewDrag").get(0);
			$element.find("#uploadFile").on('change', $scope.handleUpload);
			$scope.dragging = false;

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
				$scope.dragImage.style.top = decrementPx($scope.dragImage.style.top, pxMove);
			};
			var moveImageDown = function(pxMove) {
				$scope.prevImage.style.top = incrementPx($scope.prevImage.style.top, pxMove);
				$scope.dragImage.style.top = incrementPx($scope.dragImage.style.top, pxMove);
			};
			var moveImageLeft = function(pxMove) {
				$scope.prevImage.style.left = decrementPx($scope.prevImage.style.left, pxMove);
				$scope.dragImage.style.left = decrementPx($scope.dragImage.style.left, pxMove);
			};
			var moveImageRight = function(pxMove) {
				$scope.prevImage.style.left = incrementPx($scope.prevImage.style.left, pxMove);
				$scope.dragImage.style.left = incrementPx($scope.dragImage.style.left, pxMove);
			};
			var makeImageLarger = function(pxMove) {
				$scope.prevImage.style.width = incrementPx($scope.prevImage.style.width, pxMove);
				$scope.prevImage.style.height = calcHeight($scope.prevImage.style.width);
				$scope.dragImage.style.width = incrementPx($scope.dragImage.style.width, pxMove);
				$scope.dragImage.style.height = calcHeight($scope.dragImage.style.width);
			};
			var makeImageSmaller = function(pxMove) {
				$scope.prevImage.style.width = decrementPx($scope.prevImage.style.width, pxMove);
				$scope.prevImage.style.height = calcHeight($scope.prevImage.style.width);
				$scope.dragImage.style.width = decrementPx($scope.dragImage.style.width, pxMove);
				$scope.dragImage.style.height = calcHeight($scope.dragImage.style.width);
			};

			// Give translation time to transform title text of [input=file] instances before bootstrap.file-input parses dom.
			setTimeout(function() {
				$('#uploadFile').bootstrapFileInput();
			}, 0);

			var startX = null;
			var startY = null;
			var movementX = null;
			var movementY = null;
			// Check for out of bounds values so image stays inside preview block.
			var imageMoveabled = function(deltaY) {
				var move = true;
				var img = {width: getNumFromPx($scope.prevImage.style.width), height: getNumFromPx($scope.prevImage.style.height), left: getNumFromPx($scope.prevImage.style.left), top: getNumFromPx($scope.prevImage.style.top)};
				if (deltaY > 0) {
					if (img.width < 50 || img.height < 50) {
						move = false;
					} else if (img.height - Math.abs(img.top) < 50) {
						move = false;
					} else if (img.width - Math.abs(img.left) < 50) {
						move = false;
					}
				}
				if (img.top < 0 && img.height - Math.abs(img.top) < 50 && movementY > 0) {
					move = false;
				} else if (img.left > 150 && movementX < 0) {
					move = false;
				} else if (img.top > 150 && movementY < 0) {
					move = false;
				} else if (img.left < 0 && img.width - Math.abs(img.left) < 50 && movementX > 0) {
					move = false;
				}
				return move;
			};
			var zoomImage = function(event) {
				var deltaY = event.originalEvent.deltaY;
				if (!imageMoveabled(deltaY)) {
					return;
				}
				// zoom in
				if (deltaY < 0) {
					makeImageLarger(Math.abs(deltaY));
					moveImageLeft(Math.abs(deltaY/2));
					moveImageUp(Math.abs(deltaY/2));
				// zoom out
				} else {
					makeImageSmaller(deltaY);
					moveImageRight(deltaY/2);
					moveImageDown(deltaY/2);
				}
			};
			var moveImage = function(event) {
				movementX = startX - event.originalEvent.clientX;
				movementY = startY - event.originalEvent.clientY;
				if (!imageMoveabled()) {
					return;
				}
				if (movementX < 0) {
					moveImageRight(Math.abs(movementX));
				} else {
					moveImageLeft(movementX);
				}
				if (movementY > 0) {
					moveImageUp(movementY);
				} else {
					moveImageDown(Math.abs(movementY));
				}
				//console.log('moveImage', 'movementX', movementX, 'movementY', movementY);
				startX = event.originalEvent.clientX;
				startY = event.originalEvent.clientY;
			};
			$($scope.prevImage).on('drag dragstart dragover dragenter dragend drop', function(event) {
				event.preventDefault();
			});
			$($scope.prevImage).on('wheel', function(event) {
				//console.log('wheel', 'deltaX', event.originalEvent.deltaX, 'deltaY', event.originalEvent.deltaY, 'deltaZ', event.originalEvent.deltaZ);
				event.stopPropagation();
				event.preventDefault();
				zoomImage(event);
			});
			$($scope.prevImage).on('mousedown', function(event) {
				event.stopPropagation();
				startX = event.originalEvent.clientX;
				startY = event.originalEvent.clientY;
				$scope.$apply(function() {
					$scope.dragging = !$scope.dragging;
				});
			});
			$('#settings').on('click mouseup', function(event) {
				event.stopPropagation();
				$scope.$apply(function() {
					$scope.dragging = false;
				});
			});
			$('#settings').on('mousemove', function(event) {
				event.stopPropagation();
				if ($scope.dragging) {
					moveImage(event);
				}
			});

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
