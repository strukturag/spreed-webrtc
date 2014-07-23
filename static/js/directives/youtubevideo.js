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
define(['jquery', 'underscore', 'text!partials/youtubevideo.html', 'bigscreen'], function($, _, template, BigScreen) {

	return ["$window", "mediaStream", "alertify", "translation", "safeApply", "appData", function($window, mediaStream, alertify, translation, safeApply, appData) {

		var isYouTubeIframeAPIReady = $.Deferred();
		$window.onYouTubeIframeAPIReady = function() {
			console.log("YouTube IFrame ready");
			isYouTubeIframeAPIReady.resolve();
		};

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var addedIframeScript = false;
			var player = null;
			var playerReady = null;
			var isPublisher = null;
			var isPaused = null;
			var seekDetector = null;
			var prevTime = null;
			var prevNow = null;

			var stateEvents = {
				"-1": "youtube.unstarted",
				"0": "youtube.ended",
				"1": "youtube.playing",
				"2": "youtube.paused",
				"3": "youtube.buffering",
				"5": "youtube.videocued"
			};
			var errorIds = {
				"2": "invalidParameter",
				"5": "htmlPlayerError",
				"100": "videoNotFound",
				"101": "notAllowedEmbedded",
				"150": "notAllowedEmbedded"
			};

			$scope.playbackActive = false;
			$scope.hideControlsBar = true;
			$scope.currentVideoUrl = null;
			$scope.youtubeurl = "http://www.youtube.com/watch?v=_C92v6uKCIU";

			var onPlayerReady = function(event) {
				$scope.$apply(function(scope) {
					playerReady.resolve();
				});
			};

			var onPlayerError = function(event) {
				var error = errorIds[event.data] || "unknownError";
				$scope.$apply(function(scope) {
					scope.$emit("youtube.error", error);
				});
			};

			var onPlayerStateChange = function(event) {
				var msg = stateEvents[event.data];
				if (typeof msg === "undefined") {
					console.warn("Unknown YouTube player state", event)
					return;
				}

				$scope.$apply(function(scope) {
					console.log("State change", msg, event.target);
					scope.$emit(msg, event.target);
				});
			};

			var getYouTubeId = function(url) {
				/*
				 * Supported URLs:
				 * http://www.youtube.com/watch?v=0zM3nApSvMg&feature=feedrec_grec_index
				 * http://www.youtube.com/user/IngridMichaelsonVEVO#p/a/u/1/QdK8U-VIH_o
				 * http://www.youtube.com/v/0zM3nApSvMg?fs=1&amp;hl=en_US&amp;rel=0
				 * http://www.youtube.com/watch?v=0zM3nApSvMg#t=0m10s
				 * http://www.youtube.com/embed/0zM3nApSvMg?rel=0
				 * http://www.youtube.com/watch?v=0zM3nApSvMg
				 * http://youtu.be/0zM3nApSvMg
				 *
				 * Source: http://lasnv.net/foro/839/Javascript_parsear_URL_de_YouTube
				 */
				if (!url) {
					return null;
				}
				var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
				var match = url.match(regExp);
				if (match && match[7].length == 11) {
					return match[7];
				}
				return null;
			}

			var startDetectSeek = function() {
				var checkSeek = function() {
					if (!player) {
						return;
					}
					var now = new Date();
					var time = player.getCurrentTime();
					if (prevTime === null) {
						prevTime = time;
					}
					if (prevNow === null) {
						prevNow = now;
					}
					var deltaTime = Math.abs(time - prevTime);
					var deltaNow = (now - prevNow) * 0.001;
					if (deltaTime > deltaNow * 1.1) {
						safeApply($scope, function(scope) {
							scope.$emit("youtube.seeked", time);
						});
					}
					prevNow = now;
					prevTime = time;
				};

				if (!seekDetector) {
					seekDetector = $window.setInterval(function() {
						checkSeek();
					}, 1000);
				}
				checkSeek();
			};

			var stopDetectSeek = function() {
				if (seekDetector) {
					$window.clearInterval(seekDetector);
					seekDetector = null;
				}
				prevNow = null;
			};

			$scope.$on("youtube.playing", function() {
				prevTime = null;
				startDetectSeek();
				if (isPaused) {
					isPaused = false;
					mediaStream.webrtc.callForEachCall(function(peercall) {
						mediaStreamSendYouTubeVideo(peercall, currentToken, {
							Type: "Resume",
							Resume: true
						});
					});
				}
			});

			$scope.$on("youtube.buffering", function() {
				startDetectSeek();
			});

			$scope.$on("youtube.paused", function() {
				stopDetectSeek();
				if (!isPublisher || !currentToken) {
					return;
				}

				if (!isPaused) {
					isPaused = true;
					mediaStream.webrtc.callForEachCall(function(peercall) {
						mediaStreamSendYouTubeVideo(peercall, currentToken, {
							Type: "Pause",
							Pause: true
						});
					});
				}
			});

			$scope.$on("youtube.ended", function() {
				stopDetectSeek();
			});

			$scope.$on("youtube.seeked", function($event, position) {
				if (!isPublisher || !currentToken) {
					return;
				}

				mediaStream.webrtc.callForEachCall(function(peercall) {
					mediaStreamSendYouTubeVideo(peercall, currentToken, {
						Type: "Seek",
						Seek: {
							"position": position
						}
					});
				});
			});

			var playVideo = function(id) {
				playerReady.done(function() {
					$("#youtubeplayer").show();
					$scope.playbackActive = true;
					prevTime = null;
					prevNow = null;
					isPaused = null;
					player.loadVideoById(id);
				});
			};

			var createVideoPlayer = function(with_controls) {
				if (player && isPublisher !== with_controls) {
					player.destroy();
					player = null;
					playerReady = null;
				}

				if (!playerReady) {
					playerReady = $.Deferred();
				}

				isYouTubeIframeAPIReady.done(function() {
					if (!player) {
						var origin = $window.location.protocol + "//" + $window.location.host;
						player = new YT.Player("youtubeplayer", {
							height: "390",
							width: "640",
							playerVars: {
								"enablejsapi": "1",
								"hl": appData.language || "en",
								"autohide": "1",  // hide all controls on playback
								"rel": "0",  // don't show related videos on end
								"showinfo": "0",  // don't show title/uploader before start
								"playsinline": "1",  // play inline on iOS if possible
								"controls": with_controls ? "2" : "0",
								"disablekb": with_controls ? "0" : "1",
								"origin": origin
							},
							events: {
								"onReady": onPlayerReady,
								"onStateChange": onPlayerStateChange
							}
						});
						isPublisher = with_controls;
					}
				});
			};

			$scope.shareVideo = function(url) {
				var id = getYouTubeId(url);
				if (!id) {
					alertify.dialog.alert(translation._("Unknown URL format. Please make sure to enter a valid YouTube URL."));
					return;
				}

				mediaStream.webrtc.callForEachCall(function(peercall) {
					mediaStreamSendYouTubeVideo(peercall, currentToken, {
						Type: "Play",
						Play: {
							"url": url,
							"id": id
						}
					});
				});

				createVideoPlayer(true);
				$scope.youtubeurl = "";
				$scope.currentVideoUrl = url;
				playVideo(id);
			};

			mediaStream.api.e.on("received.youtubevideo", function(event, id, from, data, p2p) {
				if (!p2p) {
					console.warn("Received YouTubeVideo info without p2p. This should not happen!");
					return;
				}

				if (data.Type) {
					switch (data.Type) {
					case "Show":
						console.log("Received YouTubeVideo show request", data);
						$scope.$apply(function(scope) {
							scope.layout.youtubevideo = true;
						});
						break;

					case "Hide":
						console.log("Received YouTubeVideo hide request", data);
						$scope.$apply(function(scope) {
							scope.layout.youtubevideo = false;
						});
						break;

					case "Play":
						console.log("Received YouTubeVideo play request", data);
						$scope.$apply(function(scope) {
							createVideoPlayer(false);
							scope.currentVideoUrl = data.Play.url;
							playVideo(data.Play.id);
						});
						break;

					case "Pause":
						console.log("Received YouTubeVideo pause request", data);
						$scope.$apply(function(scope) {
							if (player) {
								player.pauseVideo();
							}
						});
						break;

					case "Resume":
						console.log("Received YouTubeVideo resume request", data);
						$scope.$apply(function(scope) {
							if (player) {
								player.playVideo();
							}
						});
						break;

					case "Seek":
						console.log("Received YouTubeVideo seek request", data);
						$scope.$apply(function(scope) {
							if (player) {
								player.seekTo(data.Seek.position);
							}
						});
						break;

					default:
						console.log("Received unknown YouTubeVideo event", data);
					}
				}
			});

			var peers = {};
			var youtubevideos = [];
			var youtubevideoCount = 0;
			var currentToken = null;
			var tokenHandler = null;

			var mediaStreamSendYouTubeVideo = function(peercall, token, params) {
				mediaStream.api.apply("sendYouTubeVideo", {
					send: function(type, data) {
						if (!peercall.peerconnection.datachannelReady) {
							return peercall.e.one("dataReady", function() {
								peercall.peerconnection.send(data);
							});
						} else {
							return peercall.peerconnection.send(data);
						}
					}
				})(peercall.id, token, params);
			};

			var connector = function(token, peercall) {
				if (peers.hasOwnProperty(peercall.id)) {
					// Already got a connection.
					return;
				}
				peers[peercall.id] = true;
				mediaStreamSendYouTubeVideo(peercall, token, {
					Type: "Show",
					Show: true
				});
			};

			// Updater function to bring in new calls.
			var updater = function(event, state, currentcall) {
				switch (state) {
					case "completed":
					case "connected":
						connector(currentToken, currentcall);
						break;
					case "closed":
						delete peers[currentcall.id];
						if (_.isEmpty(peers)) {
							console.log("All peers disconnected, stopping youtubevideo");
							$scope.$apply(function(scope) {
								scope.hideYouTubeVideo();
							});
						}
						break;
				}
			};

			$scope.showYouTubeVideo = function() {
				if (!addedIframeScript) {
					$element.append($('<script src="https://www.youtube.com/iframe_api"></script>'));
					addedIframeScript = true;
				}
				$scope.layout.youtubevideo = true;
				$scope.$emit("mainview", "youtubevideo", true);
				if (currentToken) {
					mediaStream.tokens.off(currentToken, tokenHandler);
				}

				// Create token to register with us and send token out to all peers.
				// Peers when connect to us with the token and we answer.
				currentToken = "youtubevideo_" + $scope.id + "_" + (youtubevideoCount++);

				// Create callbacks are called for each incoming connections.
				tokenHandler = mediaStream.tokens.create(currentToken, function(event, currenttoken, to, data, type, to2, from, peer) {
					console.log("YouTubeVideo create", currenttoken, data, type, peer);
					youtubevideos.push(peer);
				}, "youtubevideo");

				// Connect all current calls.
				mediaStream.webrtc.callForEachCall(function(peercall) {
					connector(currentToken, peercall);
				});
				// Catch later calls too.
				mediaStream.webrtc.e.on("statechange", updater);
			};

			$scope.hideYouTubeVideo = function() {
				$scope.$emit("mainview", "youtubevideo", false);
				$scope.layout.youtubevideo = false;
				if (currentToken) {
					mediaStream.webrtc.callForEachCall(function(peercall) {
						mediaStreamSendYouTubeVideo(peercall, currentToken, {
							Type: "Hide",
							Hide: true
						});
					});
					mediaStream.tokens.off(currentToken, tokenHandler);
					currentToken = null;
				}
				if (player) {
					player.destroy();
					player = null;
				}
				isPublisher = null;
				$scope.playbackActive = false;
				peers = {};
				stopDetectSeek();
				playerReady = null;
				mediaStream.webrtc.e.off("statechange", updater);
			};

			$scope.$watch("layout.youtubevideo", function(newval, oldval) {
				if (newval && !oldval) {
					$scope.showYouTubeVideo();
				} else if (!newval && oldval) {
					$scope.hideYouTubeVideo();
				}
			});

			$scope.$watch("layout.main", function(newval, oldval) {
				if (newval && newval !== "youtubevideo") {
					$scope.hideYouTubeVideo();
				}
			});

		}];

		var compile = function(tElement, tAttr) {
			return function(scope, iElement, iAttrs, controller) {
				$(iElement).on("dblclick", ".videoContainer", _.debounce(function(event) {
					scope.toggleFullscreen(event.delegateTarget);
				}, 100, true));
			}
		};

		return {
			restrict: 'E',
			replace: true,
			scope: true,
			template: template,
			controller: controller,
			compile: compile
		};

	}];

});
