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
define(['jquery', 'underscore', 'text!partials/buddypicturecapture.html'], function($, _, template) {

	// buddyPictureCapture
	return ["$compile", "$window", function($compile, $window) {

		var controller = ['$scope', 'safeApply', '$timeout', '$q', "mediaDevices", "userMedia", function($scope, safeApply, $timeout, $q, mediaDevices, userMedia) {

			var localStream = null;
			var delayToTakePicture = 3000;
			var countDownFrom = 3;

			var takePictureCountDown;
			var writeVideoToCanvas;
			var writePreviewPic;
			var makePicture;
			var videoStop;
			var videoStart;

			// Buddy picutre capture size.
			$scope.captureSize = {
				width: 128,
				height: 128
			};

			$scope.showTakePicture = false;
			$scope.waitingForPermission = false;
			$scope.previewPicture = false;
			$scope.countingDown = false;
			$scope.video = null;
			$scope.canvasPic = null;
			$scope.canvasPrev = null;

			// Counts down from start to 1
			takePictureCountDown = function(start, delayTotal) {
				$scope.countingDown = true;
				$scope.countdown = {};
				$scope.countdown.num = start;
				var decrementNum = function(num) {
					$timeout(function() {
						$scope.countdown.num--;
						if($scope.countdown.num === 0) {
							$scope.countingDown = false;
						}
					}, delayTotal/start*num);
				};
				for (var i = 1; i <= start; i++) {
					decrementNum(i);
				}
			};

			writeVideoToCanvas = function(canvas) {

				var videoWidth = $scope.video.videoWidth;
				var videoHeight = $scope.video.videoHeight;
				var aspectRatio = videoWidth/videoHeight;
				if (!aspectRatio) {
					// NOTE(longsleep): In Firefox the video size becomes available at sound point later - crap!
					console.warn("Unable to compute aspectRat§io", aspectRatio);
					aspectRatio = 1.3333333333333333;
				}
				var height = canvas.height;
				var width = canvas.width;
				var x = 0;
				var y = 0;
				if (aspectRatio >= 1) {
					x = (width - (width * aspectRatio)) / 2;
					width = width * aspectRatio;
				} else {
					y = (height - (height * (1/aspectRatio))) / 2;
					height = height * aspectRatio;

				}
				canvas.getContext("2d").drawImage($scope.video, x, y, width, height);

			};

			writePreviewPic = function() {
				writeVideoToCanvas($scope.canvasPrev);
				$scope.preview = $scope.canvasPrev.toDataURL("image/jpeg");
			};

			makePicture = function(stream, cntFrom, delayTotal) {
				takePictureCountDown(cntFrom, delayTotal);
				$timeout(function() {
					$scope.flash.addClass("flash");
					$timeout(function() {
						$scope.flash.removeClass("flash");
					}, 70);
					videoStop(stream, $scope.video);
					writePreviewPic();
					$scope.previewPicture = true;
				}, delayTotal);
			};

			videoStop = function(stream, video) {
				if (stream) {
					video.pause();
					userMedia.stopUserMediaStream(stream);
					stream = null;
				}
			};

			videoStart = function() {
				$scope.waitingForPermission = true;
				var videoConstraints = true;
				var videoAllowed = $q.defer();
				if ($scope.user.settings.cameraId) {
					videoConstraints = {
						optional: [{
							sourceId: $scope.user.settings.cameraId
						}]
					};
				}
				mediaDevices.getUserMedia({
					video: videoConstraints
				}).then(function(stream) {
					$scope.showTakePicture = true;
					localStream = stream;
					$scope.waitingForPermission = false;
					$window.attachMediaStream($scope.video, stream);
					safeApply($scope);
					videoAllowed.resolve(true);
				}).catch(function(error) {
					console.error('Failed to get access to local media. Error code was ' + error.code);
					$scope.waitingForPermission = false;
					safeApply($scope);
					videoAllowed.resolve(false);
				});
				return videoAllowed.promise;
			};

			$scope.startPictureCapture = function() {
				videoStart(localStream);
			};

			$scope.cancelPictureCapture = function() {
				$scope.showTakePicture = false;
				$scope.previewPicture = false;
				videoStop(localStream, $scope.video);
			};

			$scope.usePictureCapture = function() {
				writeVideoToCanvas($scope.canvasPic);
				$scope.save();
				$scope.cancelPictureCapture();
			};

			$scope.retakePictureCapture = function() {
				var permission = videoStart(localStream);
				permission.then(function(isPermitted) {
					if(isPermitted) {
						$scope.previewPicture = false;
						makePicture(localStream, countDownFrom, delayToTakePicture);
					}
				});
			};

			$scope.takePictureCapture = function() {
				makePicture(localStream, countDownFrom, delayToTakePicture);
			};

		}];

		var link = function($scope, $element, $attrs, modelController) {

			$scope.video = $element.find("video")[0];
			$scope.flash = $element.find(".videoFlash");
			$scope.canvasPic = $element.find("canvas.videoPic")[0];
			$scope.canvasPrev = $element.find("canvas.videoPrev")[0];
			$($scope.canvasPic).attr($scope.captureSize);

			$scope.save = function() {
				modelController.$setViewValue($scope.canvasPic.toDataURL("image/jpeg"));
			};

		};

		return {
			scope: true,
			restrict: 'E',
			require: 'ngModel',
			replace: true,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
