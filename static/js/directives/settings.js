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
define(['jquery', 'underscore', 'text!partials/settings.html'], function($, _, template) {

	return ["$compile", "mediaStream", function($compile, mediaStream) {

		var controller = ['$scope', 'desktopNotify', 'mediaSources', 'safeApply', 'availableLanguages', 'translation', '$timeout', function($scope, desktopNotify, mediaSources, safeApply, availableLanguages, translation, $timeout) {

			$scope.layout.settings = false;
			$scope.showAdvancedSettings = true;
			$scope.showTakePicture = false;
			$scope.showTakePictureReady = true;
			$scope.previewPicture = false;
			$scope.rememberSettings = true;
			$scope.desktopNotify = desktopNotify;
			$scope.mediaSources = mediaSources;
			$scope.availableLanguages = [{
				code: "",
				name: translation._("Use browser language")
			}];
			$scope.withUsers = mediaStream.config.UsersEnabled;
			$scope.withUsersRegistration = mediaStream.config.UsersAllowRegistration;
			$scope.withUsersMode = mediaStream.config.UsersMode;

			_.each(availableLanguages, function(name, code) {
				$scope.availableLanguages.push({
					code: code,
					name: name
				});
			});

			var localStream = null;

			// Make sure to save settings when they are open and the page is reloaded.
			$(window).on("unload", function() {
				if ($scope.layout.settings) {
					$scope.saveSettings();
				}
			});

			$scope.saveSettings = function() {
				var user = $scope.user;
				$scope.update(user);
				$scope.layout.settings = false;
				if ($scope.rememberSettings) {
					localStorage.setItem("mediastream-user", JSON.stringify(user));
					localStorage.setItem("mediastream-language", user.settings.language || "");
				} else {
					localStorage.removeItem("mediastream-user");
					localStorage.removeItem("mediastream-language");
					localStorage.removeItem("mediastream-access-code");
				}
			};
			$scope.cancelSettings = function() {
				$scope.reset();
				$scope.layout.settings = false;
			};
			$scope.requestDesktopNotifyPermission = function() {
				$scope.desktopNotify.requestPermission(function() {
					safeApply($scope);
				});
			};
			$scope.takePicture = function(element, take, retake, stop) {
				var delayToTakePicture = 3000;
				var takePictureCountFrom = 3;
				var takePictureCountDown = function() {
					$scope.countdown = {};
					$scope.countdown.num = 3;
					$timeout(function() {
						$scope.countdown.num = 2;
					}, delayToTakePicture/takePictureCountFrom*1);
					$timeout(function() {
						$scope.countdown.num = 1;
					}, delayToTakePicture/takePictureCountFrom*2);
					$timeout(function() {
						$scope.countdown.num = null;
					}, delayToTakePicture/takePictureCountFrom*3);
				};

				if (stop) {
					$scope.showTakePicture = false;
					$scope.previewPicture = false;
					if (localStream) {
						localStream.stop();
						localStream = null;
					}
					return;
				}

				var video = $(element).parent().parent().find("video").get(0);
				var makePicture = function() {
					takePictureCountDown();
					$timeout(function() {
						$scope.previewPicture = true;
						video.pause();
					}, delayToTakePicture);
				};

				if (!$scope.showTakePicture) {
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
						attachMediaStream(video, stream);
						safeApply($scope);
					}, function(error) {
						console.error('Failed to get access to local media. Error code was ' + error.code);
						$scope.showTakePictureReady = true;
						safeApply($scope);
					});
					return;
				} else if (take) {
					makePicture();
				} else if (retake) {
					video.play();
					$scope.previewPicture = false;
					makePicture();
				} else {
					var canvas = $(element).parent().parent().find("canvas").get(0);
					var videoWidth = video.videoWidth;
					var videoHeight = video.videoHeight;
					var aspectRatio = videoWidth/videoHeight;
					if (!aspectRatio) {
						// NOTE(longsleep): In Firefox the video size becomes available at sound point later - crap!
						console.warn("Unable to compute aspectRatio", aspectRatio);
						aspectRatio = 1.3333333333333333;
					}
					var x = (46 * aspectRatio - 46) / -2;
					canvas.getContext("2d").drawImage(video, x, 0, 46 * aspectRatio, 46);
					$scope.user.buddyPicture = canvas.toDataURL("image/jpeg");
					console.info("Image size", $scope.user.buddyPicture.length);
					localStream.stop();
					localStream = null;
					$scope.showTakePictureReady = true;
					$scope.showTakePicture = false;
					$scope.previewPicture = false;
					safeApply($scope);
				}
			};

			$scope.registerUserid = function(btn) {

				var successHandler = function(data) {
					console.info("Created new userid:", data.userid);
					// If the server provided us a nonce, we can do everthing on our own.
					mediaStream.users.store(data);
					$scope.loadedUserlogin = true;
					safeApply($scope);
					// Directly authenticate ourselves with the provided nonce.
					mediaStream.api.requestAuthentication(data.userid, data.nonce);
					delete data.nonce;
				};

				console.log("No userid - creating one ...");
				mediaStream.users.register(btn.form, function(data) {
					if (data.nonce) {
						successHandler(data);
					} else {
						// No nonce received. So this means something we cannot do on our own.
						// Make are GET request and retrieve nonce that way and let the
						// browser/server do the rest.
						mediaStream.users.authorize(data, successHandler, function(data, status) {
							console.error("Failed to get nonce after create", status, data);
						});
					}
				}, function(data, status) {
					console.error("Failed to create userid", status, data);
				});

			};

			$scope.forgetUserid = function() {
				mediaStream.users.forget();
				mediaStream.connector.forgetAndReconnect();
			};

			$scope.checkDefaultMediaSources = function() {
				if ($scope.master.settings.microphoneId && !$scope.mediaSources.hasAudioId($scope.master.settings.microphoneId)) {
					$scope.master.settings.microphoneId = null;
				}
				if ($scope.master.settings.cameraId && !$scope.mediaSources.hasVideoId($scope.master.settings.cameraId)) {
					$scope.master.settings.cameraId = null;
				}
				var audio = $scope.mediaSources.audio;
				var video = $scope.mediaSources.video;
				if (!$scope.master.settings.microphoneId && audio.length > 0) {
					$scope.master.settings.microphoneId = audio[0].id;
				}
				if (!$scope.master.settings.cameraId && video.length > 0) {
					$scope.master.settings.cameraId = $scope.mediaSources.video[0].id;
				}
				//console.log("master sources updates", $scope.master);
				$scope.refreshWebrtcSettings();
			};
			$scope.mediaSources.refresh(function() {
				safeApply($scope, $scope.checkDefaultMediaSources);
			});
			$scope.$watch("layout.settings", function(showSettings, oldValue) {
				if (showSettings) {
					$scope.desktopNotify.refresh();
					$scope.mediaSources.refresh(function(audio, video) {
						safeApply($scope, function(scope) {
							if ($scope.user.settings.microphoneId && !$scope.mediaSources.hasAudioId($scope.user.settings.microphoneId)) {
								$scope.user.settings.microphoneId = null;
							}
							if ($scope.user.settings.cameraId && !$scope.mediaSources.hasVideoId($scope.user.settings.cameraId)) {
								$scope.user.settings.cameraId = null;
							}
							if (!$scope.user.settings.microphoneId && audio.length > 0) {
								$scope.user.settings.microphoneId = audio[0].id;
							}
							if (!$scope.user.settings.cameraId && video.length > 0) {
								$scope.user.settings.cameraId = video[0].id;
							}
						});
					});
				} else if (!showSettings && oldValue) {
					$scope.saveSettings();
				}
			});
		}];

		var link = function($scope, $element) {};

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
