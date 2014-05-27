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
define(['jquery', 'underscore', 'text!partials/buddypicture.html'], function($, _, template) {

	return ["$compile", function($compile) {

		var controller = ['$scope', 'safeApply', '$timeout', function($scope, safeApply, $timeout) {

			$scope.showTakePicture = false;
			$scope.showTakePictureReady = true;
			$scope.previewPicture = false;
			$scope.countingDown = false;
			$scope.video = null;
			$scope.canvas = null;

			var localStream = null;
			var delayToTakePicture = 3000;
			var countDownFrom = 3;

			// Counts down from start to 1
			var takePictureCountDown = function(start, delayTotal) {
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
				for(var i = 1; i <= start; i++) {
					decrementNum(i);
				}
			};

			var makePicture = function(cntFrom, delayTotal) {
				takePictureCountDown(cntFrom, delayTotal);
				$timeout(function() {
					$scope.previewPicture = true;
					$scope.video.pause();
				}, delayTotal);
			};

			$scope.initPicture = function() {
				$scope.showTakePictureReady = false;
				var videoConstraints = true;
				if ($scope.user.settings.cameraId) {
					videoConstraints = {
						optional: [{
							sourceId: $scope.user.settings.cameraId
						}]
					};
				}
				getUserMedia({
					video: videoConstraints
				}, function(stream) {
					if ($scope.showTakePictureReady) {
						stream.stop();
						return;
					}
					$scope.showTakePicture = true;
					localStream = stream;
					$scope.showTakePictureReady = true;
					attachMediaStream($scope.video, stream);
					safeApply($scope);
				}, function(error) {
					console.error('Failed to get access to local media. Error code was ' + error.code);
					$scope.showTakePictureReady = true;
					safeApply($scope);
				});
			};

			$scope.cancelPicture = function() {
				$scope.showTakePicture = false;
				$scope.previewPicture = false;
				if (localStream) {
					localStream.stop();
					localStream = null;
				}
			};

			$scope.retakePicture = function() {
				$scope.video.play();
				$scope.previewPicture = false;
				makePicture(countDownFrom, delayToTakePicture);
			};

			$scope.takePicture = function() {
				makePicture(countDownFrom, delayToTakePicture);
			};

			$scope.setAsProfilePicture = function() {
				var videoWidth = $scope.video.videoWidth;
				var videoHeight = $scope.video.videoHeight;
				var aspectRatio = videoWidth/videoHeight;
				if (!aspectRatio) {
					// NOTE(longsleep): In Firefox the video size becomes available at sound point later - crap!
					console.warn("Unable to compute aspectRatio", aspectRatio);
					aspectRatio = 1.3333333333333333;
				}
				var x = (46 * aspectRatio - 46) / -2;
				$scope.canvas.getContext("2d").drawImage($scope.video, x, 0, 46 * aspectRatio, 46);
				$scope.user.buddyPicture = $scope.canvas.toDataURL("image/jpeg");
				console.info("Image size", $scope.user.buddyPicture.length);
				localStream.stop();
				localStream = null;
				$scope.showTakePictureReady = true;
				$scope.showTakePicture = false;
				$scope.previewPicture = false;
				safeApply($scope);
			};

		}];

		var link = function($scope, $element) {
			$scope.video = $element.find("video").get(0);
			$scope.canvas = $element.find("canvas").get(0);
		};

		return {
			scope: true,
			restrict: 'E',
			replace: true,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
