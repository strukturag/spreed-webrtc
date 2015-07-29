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
define(['jquery', 'underscore', 'text!partials/settings.html'], function($, _, template) {

	var videoQualityMap = {
		tiny: {
			maxWidth: 80,
			maxHeight: 45
		},
		low: {
			maxWidth: 320,
			maxHeight: 180
		},
		high: {
			maxWidth: 640,
			maxHeight: 360
		},
		hd: {
			minWidth: 1280,
			minHeight: 720,
			mandatory: {
				minWidth: 640,
				minHeight: 360
			}
		},
		fullhd: {
			minWidth: 1920,
			minHeight: 1080,
			mandatory: {
				minWidth: 1080,
				minHeight: 720
			}
		}
	};

	return ["$compile", "mediaStream", function($compile, mediaStream) {

		var controller = ['$scope', 'desktopNotify', 'mediaSources', 'safeApply', 'availableLanguages', 'translation', 'localStorage', 'userSettingsData', 'constraints', 'appData', '$timeout', function($scope, desktopNotify, mediaSources, safeApply, availableLanguages, translation, localStorage, userSettingsData, constraints, appData, $timeout) {

			$scope.layout.settings = false;
			$scope.showAdvancedSettings = true;
			$scope.autoshowSettings = true;
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

			// Make sure to save settings when they are open and the page is reloaded.
			$(window).on("unload", function() {
				if ($scope.layout.settings) {
					$scope.saveSettings();
				}
			});

			$scope.saveSettings = function() {
				var form = $scope.settingsform;
				if (form.$valid && form.$dirty) {
					var user = $scope.user;
					$scope.update(user);
					if ($scope.rememberSettings) {
						userSettingsData.save(user);
						localStorage.setItem("mediastream-language", user.settings.language || "");
					} else {
						userSettingsData.clear();
						localStorage.removeItem("mediastream-language");
						localStorage.removeItem("mediastream-access-code");
					}
					form.$setPristine();
				}
				$scope.layout.settings = false;
			};

			$scope.cancelSettings = function() {
				var form = $scope.settingsform;
				$scope.reset();
				if (form.$dirty) {
					form.$setPristine();
				}
				$scope.layout.settings = false;
			};

			$scope.requestDesktopNotifyPermission = function() {
				$scope.desktopNotify.requestPermission(function() {
					safeApply($scope);
				});
			};

			$scope.checkDefaultMediaSources = function() {
				// Check if the stuff exists.
				if ($scope.master.settings.microphoneId && !$scope.mediaSources.hasAudioId($scope.master.settings.microphoneId)) {
					$scope.master.settings.microphoneId = null;
				}
				if ($scope.master.settings.cameraId && !$scope.mediaSources.hasVideoId($scope.master.settings.cameraId)) {
					$scope.master.settings.cameraId = null;
				}
			};

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
						$scope.refreshWebrtcSettings();
					});
				} else if (!showSettings && oldValue) {
					$scope.saveSettings();
				}
			});

			$scope.maybeShowSettings = function() {
				if ($scope.autoshowSettings && mediaStream.connector.connected && !appData.authorizing()) {
					$scope.autoshowSettings = false;
					if (!$scope.loadedUser) {
						$scope.layout.settings = true;
					}
				}
			};

			$scope.$on("room.joined", function() {
				$timeout($scope.maybeShowSettings);
			});

			appData.e.on("authenticationChanged", function() {
				$scope.autoshowSettings = true;
				$timeout($scope.maybeShowSettings);
			});

			constraints.e.on("refresh", function(event, c) {

				var settings = $scope.master.settings;

				// Assert that selected devices are there.
				(function() {
					var deferred = c.defer();
					mediaSources.refresh(function() {
						$scope.checkDefaultMediaSources();
						// Select microphone device by id.
						if (settings.microphoneId) {
							c.add("audio", "sourceId", settings.microphoneId);
						}
						// Select camera by device id.
						if (settings.cameraId) {
							c.add("video", "sourceId", settings.cameraId);
						}
						if (!mediaSources.hasAudio()) {
							c.disable('audio');
							console.info("Disabled audio input as no audio source was found.");
						}
						if (!mediaSources.hasVideo()) {
							c.disable('video');
							console.info("Disabled video input as no video source was found.");
						}
						deferred.resolve("complete");
					});
				})();

				// Chrome only constraints.
				if (constraints.supported.chrome) {

					// Chrome specific constraints overview:
					// https://code.google.com/p/webrtc/source/browse/trunk/talk/app/webrtc/mediaconstraintsinterface.cc
					// https://code.google.com/p/webrtc/source/browse/trunk/talk/app/webrtc/videosource.cc (video constraints)
					// https://code.google.com/p/webrtc/source/browse/trunk/talk/app/webrtc/localaudiosource.cc (audio constraints)
					// https://code.google.com/p/webrtc/source/browse/trunk/talk/app/webrtc/webrtcsession.cc (pc constraints)

					c.add("pc", "googCpuOveruseDetection", settings.videoCpuOveruseDetection && true); // defaults to true in Chrome

					// Experimental audio settings.
					if (settings.experimental.enabled) {
						c.add("audio", "googEchoCancellation", true); // defaults to true
						c.add("audio", "googEchoCancellation2", settings.experimental.audioEchoCancellation2 && true); // defaults to false in Chrome
						c.add("audio", "googAutoGainControl", true); // defaults to true
						c.add("audio", "googAutoGainControl2", settings.experimental.audioAutoGainControl2 && true); // defaults to false in Chrome
						c.add("audio", "googNoiseSuppression", true); // defaults to true
						c.add("audio", "googNoiseSuppression2", settings.experimental.audioNoiseSuppression2 && true); // defaults to false in Chrome
						c.add("audio", "googHighpassFilter", true); // defaults to true
						c.add("audio", "googTypingNoiseDetection", settings.experimental.audioTypingNoiseDetection && true); // defaults to true in Chrome
					}

					if (constraints.supported.renderToAssociatedSink) {
						// When true uses the default communications device on Windows.
						// https://codereview.chromium.org/155863003
						c.add("audio", "googDucking", true); // defaults to true on Windows.
						// Chrome will start rendering mediastream output to an output device that's associated with
						// the input stream that was opened via getUserMedia.
						// https://chromiumcodereview.appspot.com/23558010
						c.add("audio", "chromeRenderToAssociatedSink", settings.audioRenderToAssociatedSkin && true); // defaults to false in Chrome
					}

					// Experimental video settings.
					if (settings.experimental.enabled) {

						// Changes the way the video encoding adapts to the available bandwidth.
						// https://code.google.com/p/webrtc/issues/detail?id=3351
						c.add(["video", "screensharing"], "googLeakyBucket", settings.experimental.videoLeakyBucket && true); // defaults to false in Chrome
						// Removes the noise in the captured video stream at the expense of CPU.
						c.add(["video", "screensharing"], "googNoiseReduction", settings.experimental.videoNoiseReduction && true); // defaults to false in Chrome

					}

				}

				if (constraints.supported.audioVideo) {

					// Set video quality.
					var videoQuality = videoQualityMap[settings.videoQuality];
					if (videoQuality) {
						var mandatory = videoQuality.mandatory;
						_.forEach(videoQuality, function(v, k) {
							if (k !== "mandatory") {
								c.add("video", k, v, mandatory ? false : true);
							}
						});
						if (mandatory) {
							_.forEach(mandatory, function(v, k) {
								c.add("video", k, v, true);
							});
						}
					}

					// Set max frame rate if any was selected.
					if (settings.maxFrameRate && settings.maxFrameRate != "auto") {
						c.add("video", "maxFrameRate", parseInt(settings.maxFrameRate, 10), true);
					}

					// Disable AEC if stereo.
					// https://github.com/webrtc/apprtc/issues/23
					if (settings.sendStereo) {
						c.add("audio", "echoCancellation", false);
					}

				}

			});

		}];

		return {
			scope: true,
			restrict: 'E',
			replace: true,
			template: template,
			controller: controller
		};

	}];

});
