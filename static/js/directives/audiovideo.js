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
define(['jquery', 'underscore', 'text!partials/audiovideo.html', 'text!partials/audiovideopeer.html', 'bigscreen', 'webrtc.adapter'], function($, _, template, templatePeer, BigScreen) {

	return ["$window", "$compile", "$filter", "mediaStream", "safeApply", "desktopNotify", "buddyData", "videoWaiter", "videoLayout", "animationFrame", "$timeout", "dummyStream", function($window, $compile, $filter, mediaStream, safeApply, desktopNotify, buddyData, videoWaiter, videoLayout, animationFrame, $timeout, DummyStream) {

		var peerTemplate = $compile(templatePeer);

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var streams = this.streams = {};
			var calls = {};

			$scope.container = $element[0];
			$scope.layoutparent = $element.parent();

			$scope.remoteVideos = $element.find(".remoteVideos")[0];
			$scope.localVideos = $element.find(".localVideos")[0];
			$scope.localVideo = $element.find(".localVideo")[0];
			$scope.miniVideo = $element.find(".miniVideo")[0];
			$scope.mini = $element.find(".miniContainer")[0];

			$scope.hasUsermedia = false;
			$scope.isActive = false;
			$scope.haveStreams = false;

			$scope.peersTalking = {};

			$scope.rendererName = $scope.defaultRendererName = "democrazy";

			//console.log("audiovideo", localVideo, miniVideo);

			$scope.addRemoteStream = function(stream, currentcall) {

				var id = currentcall.getStreamId(stream);
				console.log("New stream", id);

				if (streams.hasOwnProperty(id)) {
					console.warn("Cowardly refusing to add stream id twice", id);
					return;
				}

				var callscope;
				var subscope;
				if (calls.hasOwnProperty(currentcall.id)) {
					//console.log("xxx has call", id, currentcall.id);
					if (DummyStream.is(stream)) {
						return;
					}
					callscope = calls[currentcall.id];
					if (callscope.dummy) {
						// Current call is marked as dummy. Use it directly.
						var dummyId = currentcall.getStreamId(callscope.dummy);
						subscope = streams[dummyId];
						if (subscope) {
							subscope.dummy = null;
							delete streams[dummyId];
							streams[id] = subscope;
							safeApply(subscope, function(scope) {
								console.log("Replacing dummy with stream", id);
								scope.attachStream(stream);
							});
						} else {
							console.warn("Scope marked as dummy but target stream not found", dummyId);
						}
						return;
					}
				} else {
					//console.log("xxx create call scope", currentcall.id, id);
					// Create scope.
					callscope = $scope.$new();
					calls[currentcall.id] = callscope;
					callscope.streams = 0;
					console.log("Created call scope", id);
				}

				// Create scope for this stream.
				subscope = callscope.$new();
				callscope.streams++;
				var peerid = subscope.peerid = currentcall.id;
				buddyData.push(peerid);
				subscope.unattached = true;
				subscope.withvideo = false;
				subscope.onlyaudio = false;
				subscope.destroyed = false;
				subscope.$on("active", function() {
					console.log("Stream scope is now active", id, peerid);
				});
				subscope.$on("$destroy", function() {
					if (subscope.destroyed) {
						return;
					}
					console.log("Destroyed scope for stream", id, peerid);
					subscope.destroyed = true;
					callscope.streams--;
					if (callscope.streams < 1) {
						callscope.$destroy();
						delete calls[peerid];
						console.log("Destroyed scope for call", peerid, id);
					}
				});
				console.log("Created stream scope", id);

				// If stream is a dummy, mark us in callscope.
				if (DummyStream.is(stream)) {
					callscope.dummy = stream;
				}

				// Add created scope.
				streams[id] = subscope;

				// Render template.
				peerTemplate(subscope, function(clonedElement, scope) {
					clonedElement.data("peerid", scope.peerid);
					scope.element = clonedElement;
					scope.attachStream = function(stream) {
						if (DummyStream.is(stream)) {
							scope.withvideo = false;
							scope.onlyaudio = true;
							$timeout(function() {
								scope.$emit("active", currentcall);
								$scope.redraw();
							});
							return;
						} else {
							var video = clonedElement.find("video")[0];
							$window.attachMediaStream(video, stream);
							// Waiter callbacks also count as connected, as browser support (FireFox 25) is not setting state changes properly.
							videoWaiter.wait(video, stream, function(withvideo) {
								if (scope.destroyed) {
									console.log("Abort wait for video on destroyed scope.");
									return;
								}
								if (withvideo) {
									scope.$apply(function($scope) {
										$scope.withvideo = true;
										$scope.onlyaudio = false;
									});
								} else {
									console.info("Incoming stream has no video tracks.");
									scope.$apply(function($scope) {
										$scope.withvideo = false;
										$scope.onlyaudio = true;
									});
								}
								scope.$emit("active", currentcall);
								$scope.redraw();
							}, function() {
								if (scope.destroyed) {
									console.log("No longer wait for video on destroyed scope.");
									return;
								}
								console.warn("We did not receive video data for remote stream", currentcall, stream, video);
								scope.$emit("active", currentcall);
								$scope.redraw();
							});
							scope.dummy = null;
						}
						scope.unattached = false;
					};
					scope.doChat = function() {
						$scope.$emit("startchat", currentcall.id, {
							autofocus: true,
							restore: true
						});
					};
					scope.attachStream(stream);
					$($scope.remoteVideos).append(clonedElement);
				});

			};

			$scope.removeRemoteStream = function(stream, currentcall) {

				var id = currentcall.getStreamId(stream);
				console.log("Stream removed", id);

				var subscope = streams[id];
				if (subscope) {
					buddyData.pop(currentcall.id);
					delete streams[id];
					if (subscope.element) {
						subscope.element.remove();
					}
					subscope.$destroy();
					$scope.redraw();
				}

			};

			// Talking updates receiver.
			mediaStream.api.e.on("received.talking", function(event, id, from, talking) {
				$scope.$apply(function(scope) {
					scope.peersTalking[from] = !!talking;
				});
			});

			$scope.$on("active", function(currentcall) {

				//console.log("active 2");
				if (!$scope.isActive) {
					$scope.isActive = true;
					$scope.remoteVideos.style.opacity = 1;
					$element.addClass("active");
					//console.log("active 3");
					_.delay(function() {
						$scope.localVideos.style.opacity = 0;
						$scope.localVideo.style.opacity = 0;
						$scope.localVideo.src = "";
					}, 500);
					_.delay(function() {
						//console.log("active 4", $scope.mini);
						$($scope.mini).addClass("visible");
					}, 1000);
				}

			});

			$scope.toggleFullscreen = function() {
				//console.log("Toggle full screen", BigScreen.enabled, $scope.isActive, $scope.hasUsermedia);
				if (BigScreen.enabled && ($scope.isActive || $scope.hasUsermedia)) {
					BigScreen.toggle($scope.layoutparent[0], function() {
						// onEnter
						$scope.layoutparent.addClass("fullscreen");
					}, function() {
						// onExit
						$scope.layoutparent.removeClass("fullscreen");
					});
				}
			};

			mediaStream.webrtc.e.on("usermedia", function(event, usermedia) {

				if (!usermedia || !usermedia.started) {
					return;
				}

				//console.log("XXXX XXXXXXXXXXXXXXXXXXXXX usermedia event", usermedia);
				if ($scope.haveStreams) {

					usermedia.attachMediaStream($scope.miniVideo);
					$scope.redraw();

				} else {

					$scope.hasUsermedia = true;
					usermedia.attachMediaStream($scope.localVideo);
					var count = 0;
					var waitForLocalVideo = function() {
						if (!$scope.hasUsermedia || $scope.isActive) {
							return;
						}
						if ($scope.localVideo.videoWidth > 0) {
							console.log("Local video size: ", $scope.localVideo.videoWidth, $scope.localVideo.videoHeight);
							$scope.localVideo.style.opacity = 1;
							$scope.redraw();
						} else {
							count++;
							if (count < 100) {
								setTimeout(waitForLocalVideo, 100);
							} else {
								console.warn("Timeout while waiting for local video.")
							}
						}
					};
					waitForLocalVideo();

				}

			});

			mediaStream.webrtc.e.on("done stop", function(event) {

				safeApply($scope, function(scope) {
					if (!scope.isActive) {
						return;
					}
					scope.hasUsermedia = false;
					scope.isActive = false;
					scope.peersTalking = {};
					if (BigScreen.enabled) {
						BigScreen.exit();
					}
					var removeVideos = function() {
						if (scope.isActive) {
							return;
						}
						scope.localVideo.src = '';
						scope.miniVideo.src = '';
						$(scope.remoteVideos).children(".remoteVideo").remove();
					};
					if (event.type === "stop") {
						removeVideos();
					} else {
						$timeout(removeVideos, 1500);
					}
					$(scope.mini).removeClass("visible");
					scope.localVideos.style.opacity = 1;
					scope.localVideo.style.opacity = 0;
					scope.remoteVideos.style.opacity = 0;
					$element.removeClass('active');
					_.each(streams, function(streamscope, k) {
						streamscope.$destroy();
						delete streams[k];
					});
					scope.rendererName = scope.defaultRendererName;
					scope.haveStreams = false;
				});

			});

			mediaStream.webrtc.e.on("streamadded", function(event, stream, currentcall) {

				console.log("Remote stream added.", stream, currentcall);
				if (!$scope.haveStreams) {
					//console.log("First stream");
					$window.reattachMediaStream($scope.miniVideo, $scope.localVideo);
					$scope.haveStreams = true;
				}
				if (stream === null) {
					// Inject dummy stream.
					stream = new DummyStream();
				}
				$scope.addRemoteStream(stream, currentcall);

			});

			mediaStream.webrtc.e.on("streamremoved", function(event, stream, currentcall) {

				console.log("Remote stream removed.", stream, currentcall);
				$scope.removeRemoteStream(stream, currentcall);

			});

			mediaStream.webrtc.e.on("statechange", function(event, iceConnectionState, currentcall) {

				if (!$scope.haveStreams || currentcall.closed) {
					return;
				}

				switch (iceConnectionState) {
				case "new":
				case "checking":
				case "connected":
				case "completed":
				case "failed":
					$scope.addRemoteStream(new DummyStream(), currentcall);
					break;
				}

			});

		}];

		var compile = function(tElement, tAttr) {

			return function(scope, iElement, iAttrs, controller) {

				//console.log("compile", arguments)

				iElement.on("doubletap dblclick", _.debounce(scope.toggleFullscreen, 100, true));

				var rendererName = null;
				var getRendererName = function() {
					// Return name of current renderer.
					if (rendererName !== null) {
						return rendererName;
					} else {
						return scope.rendererName;
					}
				};
				var forceRendererName = function(name) {
					// Allow change between some renderes when forced.
					if (name === "classroom") {
						rendererName = "classroom";
					} else {
						rendererName = "smally";
					}
				};

				scope.setRenderer = function(name) {
					scope.rendererName = name;
					if (rendererName && rendererName !== name) {
						forceRendererName(name);
					}
				};

				var needsRedraw = false;
				scope.redraw = function() {
					needsRedraw = true;
				};

				var redraw = function() {
					var size = {
						width: scope.layoutparent.width(),
						height: scope.layoutparent.height()
					}
					var name;
					if (size.width < 1 || size.height < 1) {
						// Use invisible renderer when no size available.
						name = "invisible";
					} else {
						name = getRendererName();
					}
					var again = videoLayout.update(name, size, scope, controller);
					if (again) {
						// Layout needs a redraw.
						needsRedraw = true;
					}
				};

				// Make sure we draw on resize.
				$($window).on("resize", scope.redraw);
				scope.$on("mainresize", function(event, main) {
					if (main) {
						// Force smally renderer or pin classroom when we have a main view.
						forceRendererName(scope.rendererName);
					} else if (rendererName) {
						rendererName = null;
					}
					_.defer(scope.redraw);
				});
				scope.redraw();

				// Make sure we draw when the renderer was changed.
				scope.$watch("rendererName", function() {
					_.defer(scope.redraw);
				});

				// Update function run in rendering thread.
				var update = function() {
					if (needsRedraw) {
						needsRedraw = false;
						redraw();
					}
				}
				animationFrame.register(update);

			}

		};

		return {
			restrict: 'E',
			replace: true,
			scope: true,
			template: template,
			controller: controller,
			compile: compile
		}

	}];

});
