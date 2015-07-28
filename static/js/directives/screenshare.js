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
define(['jquery', 'underscore', 'text!partials/screenshare.html', 'text!partials/screensharepeer.html', 'bigscreen', 'webrtc.adapter'], function($, _, template, templatePeer, BigScreen) {

	return ["$window", "mediaStream", "$compile", "safeApply", "videoWaiter", "$timeout", "alertify", "translation", "screensharing", function($window, mediaStream, $compile, safeApply, videoWaiter, $timeout, alertify, translation, screensharing) {

		var peerTemplate = $compile(templatePeer);

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var screenCount = 0;
			var screens = {};
			var pane = $element.find(".screensharepane");

			$scope.layout.screenshare = false;
			$scope.usermedia = null;
			$scope.connected = false;

			$scope.hideOptionsBar = true;
			$scope.fitScreen = true;

			var handleRequest = function(event, currenttoken, to, data, type, to2, from, peerscreenshare) {

				console.log("Screen share answer message", currenttoken, data, type);

				if (typeof data === "string") {

					if (data.charCodeAt(0) === 2) {
						// Ignore whatever shit is sent us by Firefox.
						return;
					}
					// Control data request.
					var msg;
					try {
						msg = JSON.parse(data);
					} catch (e) {
						// Invalid JSON.
						console.warn("Invalid JSON received from screen share channel.", data);
						peerscreenshare.close();
						return;
					}

					switch (msg.m) {
						case "bye":
							// Close this screen share.
							peerscreenshare.close();
							break;
						default:
							console.log("Unknown screen share control request", msg.m, msg);
							break;
					}

				} else {

					console.warn("Unkown data type received -> ignored", typeof data, [data]);
					peerscreenshare.close();

				}

			};

			mediaStream.api.e.on("received.screenshare", function(event, id, from, data, p2p) {

				if (!p2p) {
					console.warn("Received screensharing info without p2p. This should not happen!");
					return;
				}

				var token = data.id;

				// Bind token.
				var handler = mediaStream.tokens.on(token, handleRequest, "screenshare");

				// Subscribe to peers screensharing.
				mediaStream.webrtc.doSubscribeScreenshare(from, token, {
					created: function(peerscreenshare) {
						peerscreenshare.e.on("remoteStreamAdded", function(event, stream) {
							if (stream) {
								$scope.$apply(function(scope) {
									scope.addRemoteStream(stream, peerscreenshare);
								});
							}
						});
						peerscreenshare.e.on("remoteStreamRemoved", function(event, stream) {
							safeApply($scope, function(scope) {
								scope.removeRemoteStream(stream, peerscreenshare);
							});
						});
					},
					connected: function(peerscreenshare) {
						console.log("PeerScreenshare connected", peerscreenshare);
						$scope.$apply(function(scope) {
							scope.connected = true;
						});
					},
					closed: function(peerscreenshare) {
						console.log("PeerScreenshare closed", peerscreenshare);
						safeApply($scope, function(scope) {
							scope.removeRemoteStream(null, peerscreenshare);
							scope.connected = false;
						});
						mediaStream.tokens.off(token, handler);
						handler = null;
					}
				});

			});

			$scope.addRemoteStream = function(stream, currentscreenshare) {

				$scope.$emit("mainview", "screenshare", true);

				var subscope = $scope.$new(true);
				var peerid = subscope.peerid = currentscreenshare.id;

				peerTemplate(subscope, function(clonedElement, scope) {
					pane.append(clonedElement);
					scope.element = clonedElement;
					var video = clonedElement.find("video")[0];
					$window.attachMediaStream(video, stream);
					videoWaiter.wait(video, stream, function() {
						console.log("Screensharing size: ", video.videoWidth, video.videoHeight);
					}, function() {
						console.warn("We did not receive screen sharing video data", currentscreenshare, stream, video);
					});
					screens[peerid] = scope;
				});

			};

			$scope.removeRemoteStream = function(stream, currentscreenshare) {

				var subscope = screens[currentscreenshare.id];
				if (subscope) {
					delete screens[currentscreenshare.id];
					if (subscope.element) {
						subscope.element.remove();
					}
					subscope.$destroy();
				}

				if (_.isEmpty(screens)) {
					$scope.$emit("mainview", "screenshare", false);
				}

			};

			$scope.doScreenshare = function() {

				if ($scope.layout.screenshare) {
					$scope.stopScreenshare();
				}

				$scope.layout.screenshare = true;
				screensharing.getScreen().then(function(options) {
					if (options) {
						$scope.startScreenshare(options);
					} else {
						// No options received - assume cancel.
						$scope.stopScreenshare();
					}
				}, function(err) {
					console.log("Screen sharing request returned error", err);
					alertify.dialog.alert(translation._("Failed to start screen sharing (%s).", err));
					$scope.stopScreenshare();
				});

			};

			$scope.startScreenshare = function(options) {

				// Create userMedia with screen share type.
				var usermedia = mediaStream.webrtc.doScreenshare(options);
				var handler;
				var peers = {};
				var screenshares = [];

				var connector = function(token, peercall) {
					if (peers.hasOwnProperty(peercall.id)) {
						// Already got a connection.
						return;
					}
					peers[peercall.id] = true;
					peercall.e.one("closed", function(event, currentcall) {
						delete peers[currentcall.id];
						console.log("Removed closed call from screen sharing.", currentcall.id);
					});
					mediaStream.api.apply("sendScreenshare", {
						send: function(type, data) {
							//console.log("sent screenshare", data, peercall);
							return peercall.peerconnection.send(data);
						}
					})(peercall.from, token);
				};

				usermedia.e.one("mediasuccess", function(event, usermedia) {
					$scope.$apply(function(scope) {

						scope.usermedia = usermedia;
						// Create token to register with us and send token out to all peers.
						// Peers when connect to us with the token and we answer.
						var token = "screenshare_" + scope.id + "_" + (screenCount++);

						// Updater function to bring in new calls.
						var updater = function(event, state, currentcall) {
							switch (state) {
								case "completed":
								case "connected":
									connector(token, currentcall);
									break;
							}
						};

						// Create callbacks are called for each incoming connections.
						handler = mediaStream.tokens.create(token, function(event, currenttoken, to, data, type, to2, from, peerscreenshare) {
							console.log("Screen share create", currenttoken, data, type, peerscreenshare);
							screenshares.push(peerscreenshare);
							usermedia.addToPeerConnection(peerscreenshare.peerconnection);
						}, "screenshare");

						// Connect all current calls.
						mediaStream.webrtc.callForEachCall(function(peercall) {
							connector(token, peercall);
						});
						// Catch later calls too.
						mediaStream.webrtc.e.on("statechange", updater);

						// Cleanup on stop of media.
						usermedia.e.one("stopped", function() {
							mediaStream.tokens.off(token, handler);
							mediaStream.webrtc.e.off("statechange", updater);
							handler = null;
							// Send by to all connected peers.
							_.each(screenshares, function(peerscreenshare) {
								peerscreenshare.send({
									m: "bye"
								});
								$timeout(function() {
									peerscreenshare.close();
								}, 0);
							});
							peers = {};
							screenshares = [];
							// Make sure to clean up.
							safeApply(scope, function(scope) {
								scope.stopScreenshare();
							});
						});

					});
				});

				usermedia.e.one("mediaerror", function(event, usermedia, error) {
					$scope.$apply(function(scope) {
						scope.stopScreenshare();
					});
					if (error && error.name) {
						switch (error.name) {
						case "PermissionDeniedError":
						case "InvalidStateError":
							if ($window.webrtcDetectedVersion >= 32 &&
								$window.webrtcDetectedVersion < 37) {
								alertify.dialog.alert(translation._("Permission to start screen sharing was denied. Make sure to have enabled screen sharing access for your browser. Copy chrome://flags/#enable-usermedia-screen-capture and open it with your browser and enable the flag on top. Then restart the browser and you are ready to go."));
							} else {
								alertify.dialog.alert(translation._("Permission to start screen sharing was denied."));
							}
							break;
						default:
							alertify.dialog.alert(translation._("Failed to start screen sharing (%s).", error.name));
							break
						}
					}
				});

			};

			$scope.stopScreenshare = function() {

				if ($scope.usermedia) {
					$scope.usermedia.stop()
					$scope.usermedia = null;
					console.log("Screen share stopped.");
				}

				if ($scope.layout.screenshare) {
					screensharing.cancelGetScreen();
					$scope.layout.screenshare = false;
				}

			};

			$scope.toggleFullscreen = function(elem) {

				if (BigScreen.enabled) {
					if (elem) {
						BigScreen.toggle(elem);
					} else {
						BigScreen.toggle(pane[0]);
					}
				}

			};

			mediaStream.webrtc.e.on("done", function() {
				$scope.$apply($scope.stopScreenshare);
			});

			$scope.$watch("layout.screenshare", function(newval, oldval) {
				if (newval && !oldval) {
					$scope.doScreenshare();
				} else if (!newval && oldval) {
					$scope.stopScreenshare();
				}
			});

			$scope.$watch("layout.main", function(newval, oldval) {
				if (newval && newval !== "screenshare") {
					$scope.stopScreenshare();
				}
			});

		}];

		var compile = function(tElement, tAttr) {
			return function(scope, iElement, iAttrs, controller) {
				$(iElement).on("dblclick", ".remotescreen", _.debounce(function(event) {
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
		}

	}];

});
