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
define(['jquery', 'underscore', 'moment'], function($, _, moment) {

	return ["fileData", "fileUpload", "fileDownload", "mediaStream", "$window", "alertify", "translation", function(fileData, fileUpload, fileDownload, mediaStream, $window, alertify, translation) {

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var ctrl = this;

			console.log("file-info", $scope, $element);
			$scope.complete = false;
			$scope.downloader = false;
			$scope.downloadcomplete = false;
			$scope.downloading = false;
			$scope.downloadspeed = false;
			$scope.uploading = false;
			$scope.uploader = false;
			$scope.cancelled = false;
			$scope.error = false;
			$scope.progress = 0;
			$scope.progressDownload = 0;
			$scope.bytesPerSecond = 0;
			$scope.eta = "";
			$scope.url = null;

			var progressBars = $element.find(".file-info-size > div");
			var progressBar = progressBars[0];
			var progressBarDownload = progressBars[1];
			$scope.$watch("progress", function() {
				progressBar.style.width = ($scope.progress) + "%";
			});
			$scope.$watch("progressDownload", function() {
				progressBarDownload.style.width = ($scope.progressDownload) + "%";
			});

			$scope.$watch("error", function() {
				// TODO(longsleep): Show some feedback?
			});

			var chunk = 0;
			var handler = null;
			var token = $scope.info.id;
			var bytesIn = [];
			var bytesPerSecond = [];
			var bytesPerSecondInterval = null;

			ctrl.bytesPerSecond = function() {
				if ($scope.downloadcomplete || $scope.cancelled || $scope.error) {
					$window.clearInterval(bytesPerSecondInterval);
					$scope.$apply(function(scope) {
						$scope.downloadspeed = false;
						$scope.eta = "";
					});
					return;
				}
				var bpsIn = 0;
				if (bytesIn.length) {
					bpsIn = _.reduce(bytesIn, function(memo, num) {
						return memo + num;
					}, 0);
					bytesIn = [];
				}
				bytesPerSecond.push(bpsIn);
				if (bytesPerSecond.length > 3) {
					bytesPerSecond.shift();
				}

				// Compute left bytes for eta.
				var bytesLeft = $scope.info.size - ($scope.info.size * ($scope.progress / 100));

				$scope.$apply(function(scope) {
					scope.bytesPerSecond = _.reduce(bytesPerSecond, function(memo, num) {
						return memo + num;
					}, 0) / bytesPerSecond.length;
					if (scope.downloader && (scope.bytesPerSecond || scope.eta)) {
						if (scope.bytesPerSecond > 0) {
							var etaSeconds = bytesLeft / scope.bytesPerSecond;
							scope.eta = moment.duration(etaSeconds, "seconds").humanize();
						} else {
							scope.eta = "";
						}
					}
					if (!scope.downloadspeed && scope.bytesPerSecond > 0) {
						scope.downloadspeed = true;
					} else if (!scope.downloader && scope.bytesPerSecond === 0) {
						scope.downloadspeed = false;
					}
				});
			};

			$scope.reset = function() {
				chunk = 0;
				bytesIn = [];
				bytesPerSecond = [];
				$window.clearInterval(bytesPerSecondInterval);
				bytesPerSecondInterval = null;
				$scope.complete = false;
				$scope.downloading = false;
				$scope.downloadcomplete = false;
				$scope.downloadspeed = false;
				$scope.progress = 0;
				$scope.progressDownload = 0;
				$scope.bytesPerSecond = 0;
				$scope.eta = "";
				$scope.error = false;
				$scope.url = null;
			};

			$scope.download = function() {

				if (!fileDownload.supported) {
					alertify.dialog.alert(translation._("Your browser does not support file transfer."));
					return;
				}

				if ($scope.error && $scope.downloading) {
					// Crude retry support.
					$scope.reset();
				}

				console.log("Download", $scope.info, $scope);
				if (!$scope.complete && !$scope.downloading) {
					$scope.downloading = true;
					$scope.cancelled = false;
					bytesPerSecondInterval = $window.setInterval(ctrl.bytesPerSecond, 1000);
					$scope.$emit("download", $scope.from, $scope.info.id);
				} else {
					if ($scope.url) {
						$window.open($scope.url, "_blank");
					} else {
						console.error("Download of already completed files not implemented yet.");
					}
				}

			};

			$scope.cancel = function() {

				console.log("Download cancel", $scope.downloading, $scope);
				$scope.cancelled = true;
				if ($scope.downloading) {
					$scope.$emit("cancelDownload");
				}
				if ($scope.uploader) {
					console.log("Removing upload handler");
					if (handler) {
						mediaStream.tokens.off(token, handler);
						$scope.uploader = false;
					}
					$scope.$emit("cancelUpload");
				}
				$scope.reset();

			};

			$scope.$on("downloadedWritten", function(event, written, queue) {
				event.stopPropagation();
				if ($scope.cancelled) {
					return;
				}
				$scope.progress = Math.ceil((written / ($scope.info.chunks - 1)) * 100);
				if (written >= $scope.info.chunks - 1) {
					$scope.progress = 100;
				}
			});

			$scope.$on("downloadedChunk", function(event, idx, bytesLength) {
				event.stopPropagation();
				if ($scope.cancelled) {
					return;
				}
				bytesIn.push(bytesLength);
				$scope.progressDownload = Math.ceil((chunk / ($scope.info.chunks - 1)) * 100);
				chunk++;
			});

			$scope.$on("writeComplete", function(event, url) {
				event.stopPropagation();
				$scope.complete = true;
				$scope.url = url;
				$scope.progress = 100;
			});

			$scope.$on("downloadComplete", function(event) {
				event.stopPropagation();
				$scope.downloadcomplete = true;
				$scope.progressDownload = 100;
			});

			$scope.$on("uploadedChunk", function(event, idx, bytesLength) {
				event.stopPropagation();
				//console.log("Uploaded chunk", idx, bytesLength);
				if ($scope.cancelled) {
					return;
				}
				bytesIn.push(bytesLength);
			});

			// Register as token handler when we are sending.
			var file = fileData.getFile($scope.info.id);
			if (file) {
				$scope.uploader = true;
				console.log("File-info has file on create", file);
				var session = fileUpload.startUpload($scope, $scope.info.id);
				// This binds the token to transfer and ui.
				handler = mediaStream.tokens.on(token, function(event, currenttoken, to, data, type, to2, from, xfer) {
					//console.log("File token request", currenttoken, data, type);
					session.handleRequest($scope, xfer, data);
				}, "xfer");
				bytesPerSecondInterval = $window.setInterval(ctrl.bytesPerSecond, 1000);
			} else {
				$scope.downloader = true;
				// This binds the token to transfer and ui.
				handler = mediaStream.tokens.on(token, function(event, currenttoken, to, data, type, to2, from, xfer) {
					//console.log("File token request", currenttoken, data, type);
					fileDownload.handleRequest($scope, xfer, data);
				}, "xfer");
			}

		}];

		return {
			scope: true,
			restrict: 'EAC',
			controller: controller,
			replace: false
		}

	}];

});
