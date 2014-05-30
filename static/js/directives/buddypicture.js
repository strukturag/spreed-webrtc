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

		var controller = ['$scope', 'safeApply', '$timeout', '$q', function($scope, safeApply, $timeout, $q) {

			$scope.showTakePicture = false;
			$scope.waitingForPermission = false;
			$scope.previewPicture = false;
			$scope.countingDown = false;
			$scope.videoPrim = null;
			$scope.videoSec = null;
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

			var makePicture = function(stream, cntFrom, delayTotal) {
				takePictureCountDown(cntFrom, delayTotal);
				reattachMediaStream($scope.videoSec, $scope.videoPrim);
				$timeout(function() {
					$scope.previewPicture = true;
					videoStop(stream, $scope.videoPrim, $scope.videoSec);
				}, delayTotal);
			};

			var videoStop = function(stream, video1, video2) {
				if (stream) {
					video1.pause();
					video2.pause();
					stream.stop();
					stream = null;
				}
			};

			var videoStart = function() {
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
				getUserMedia({
					video: videoConstraints
				}, function(stream) {
					$scope.showTakePicture = true;
					localStream = stream;
					$scope.waitingForPermission = false;
					attachMediaStream($scope.videoPrim, stream);
					safeApply($scope);
					videoAllowed.resolve(true);
				}, function(error) {
					console.error('Failed to get access to local media. Error code was ' + error.code);
					$scope.waitingForPermission = false;
					safeApply($scope);
					videoAllowed.resolve(false);
				});
				return videoAllowed.promise;
			};

			$scope.initPicture = function() {
				videoStart(localStream);
			};

			$scope.cancelPicture = function() {
				$scope.showTakePicture = false;
				$scope.previewPicture = false;
				videoStop(localStream, $scope.videoPrim, $scope.videoSec);
			};

			$scope.retakePicture = function() {
				var permission = videoStart(localStream);
				permission.then(function(isPermitted) {
					if(isPermitted) {
						$scope.previewPicture = false;
						makePicture(localStream, countDownFrom, delayToTakePicture);
					}
				});
			};

			$scope.takePicture = function() {
				makePicture(localStream, countDownFrom, delayToTakePicture);
			};

			$scope.setAsProfilePicture = function() {
				var videoWidth = $scope.videoSec.videoWidth;
				var videoHeight = $scope.videoSec.videoHeight;
				var aspectRatio = videoWidth/videoHeight;
				if (!aspectRatio) {
					// NOTE(longsleep): In Firefox the video size becomes available at sound point later - crap!
					console.warn("Unable to compute aspectRatio", aspectRatio);
					aspectRatio = 1.3333333333333333;
				}
				var x = (46 * aspectRatio - 46) / -2;
				$scope.canvas.getContext("2d").drawImage($scope.videoSec, x, 0, 46 * aspectRatio, 46);
				$scope.user.buddyPicture = $scope.canvas.toDataURL("image/jpeg");
				console.info("Image size", $scope.user.buddyPicture.length);
				$scope.cancelPicture();
				safeApply($scope);
			};

		}];

		var link = function($scope, $element) {
			$scope.videoPrim = $element.find("video#prim").get(0);
			$scope.videoSec = $element.find("video#sec").get(0);
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
