/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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
define(['jquery', 'underscore', 'text!partials/screenshare.html', 'text!partials/screensharepeer.html', 'bigscreen'], function($, _, template, templatePeer, BigScreen) {

	return ["$window", "mediaStream", "$compile", "safeApply", "videoWaiter", "$timeout", function($window, mediaStream, $compile, safeApply, videoWaiter, $timeout) {

		var peerTemplate = $compile(templatePeer);

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var screenCount = 0;
			var screens = {};

			$scope.layout.screenshare = false;
			$scope.usermedia = null;
			$scope.connected = false;
			$scope.screenshare = null;

			var handleRequest = function(event, currenttoken, to, data, type, to2, from, peerscreenshare) {

				console.log("Screen share answer message", currenttoken, data, type);

				if (typeof data === "string") {

					if (data.charCodeAt(0) === 2) {
						// Ignore whatever shit is sent us by Firefox.
						return;
					}
					// Control data request.
					try {
						var msg = JSON.parse(data);
					} catch(e) {
						// Invalid JSON.
						console.warn("Invalid JSON received from screen share channel.", data);
						peerscreenshare.close()
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
							$scope.$apply(function(scope) {
								scope.addRemoteStream(stream, peerscreenshare);
							});
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
					$element.append(clonedElement);
					scope.element = clonedElement;
					var video = clonedElement.find("video").get(0);
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

				$scope.layout.screenshare = true;

				// Create userMedia with screen share type.
				var usermedia = mediaStream.webrtc.doScreenshare();
				var handler;
				var peers = {};

				var connector = function(token, peercall) {
					if (peers.hasOwnProperty(peercall.id)) {
						// Already got a connection.
						return;
					}
					peers[peercall.id] = true;
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
						var token = "screenshare_"+scope.id+"_"+(screenCount++);
						// Updater function to bring in new calls.
						var updater = function(event, state, currentcall) {
							switch (state) {
							case "completed":
							case "connected":
								connector(token, currentcall);
								break;
							}
						};
						handler = mediaStream.tokens.create(token, function(event, currenttoken, to, data, type, to2, from, peerscreenshare) {
							//console.log("Screen share create", currenttoken, data, type, peerscreenshare);
							$scope.screenshare = peerscreenshare;
							usermedia.e.one("stopped", function() {
								mediaStream.tokens.off(token, handler);
								mediaStream.webrtc.e.off("statechange", updater);
								handler = null;
								updated = null;
								peers = {};
								safeApply(scope, function(scope) {
									scope.stopScreenshare();
								});
							});
							usermedia.addToPeerConnection(peerscreenshare.peerconnection);
						}, "screenshare");
						// Connect all current calls.
						mediaStream.webrtc.callForEachCall(function(peercall) {
							connector(token, peercall);
						});
						// Catch later calls too.
						mediaStream.webrtc.e.on("statechange", updater);
					});
				});

				usermedia.e.one("mediaerror", function() {
					$scope.$apply(function(scope) {
						scope.usermedia = null;
					});
				});

			};

			$scope.stopScreenshare = function() {

				if ($scope.screenshare) {
					$scope.screenshare.send({m: "bye"});
					(function(screenshare) {
						$timeout(function() {
							screenshare.close();
						}, 0);
					}($scope.screenshare));
					$scope.screenshare = null;
				}

				if ($scope.usermedia) {
					$scope.usermedia.stop()
					$scope.usermedia = null;
					console.log("Screen share stopped.");
				}

				$scope.layout.screenshare = false;

			};

			$scope.toggleFullscreen = function(elem) {

				if (BigScreen.enabled) {
					if (elem) {
						BigScreen.toggle(elem);
					} else {
						BigScreen.toggle($element.get(0));
					}
                }

			};

	        $scope.$watch("layout.screenshare", function(newval, oldval) {
	            if (newval && !oldval) {
	                $scope.doScreenshare();
	            } else if(!newval && oldval) {
	            	$scope.stopScreenshare();
	            }
	        });

		}];

		var compile = function(tElement, tAttr) {
			return function(scope, iElement, iAttrs, controller) {
				$(iElement).on("dblclick", ".remoteScreen", function(event) {
					scope.toggleFullscreen(event.delegateTarget);
				});
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