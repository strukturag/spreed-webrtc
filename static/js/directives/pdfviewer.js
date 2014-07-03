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
define(['jquery', 'underscore', 'text!partials/pdfviewer.html'], function($, _, template) {

	return ["$window", "mediaStream", "fileUpload", "fileDownload", "alertify", "translation", "randomGen", function($window, mediaStream, fileUpload, fileDownload, alertify, translation, randomGen) {

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var pdfViewerCount = 0;
			var pane = $element.find(".pdfviewerpane");

			$scope.layout.pdfviewer = false;
			$scope.isPresenter = false;
			$scope.hideControlsBar = false;

			$scope.$on("pdfLoaded", function(event, source, doc) {
				if ($scope.isPresenter) {
					$scope.$emit("showPdfPage", 1);
				} else {
					$scope.$emit("showQueuedPdfPage");
				}
			});

			var handleRequest = function(event, currenttoken, to, data, type, to2, from, peerpdfviewer) {
				console.log("PdfViewer answer message", currenttoken, data, type);
			};

			mediaStream.api.e.on("received.pdfviewer", function(event, id, from, data, p2p) {
				if (!p2p) {
					console.warn("Received pdfviewer info without p2p. This should not happen!");
					return;
				}

				var token = data.id;
				$scope.$emit("mainview", "pdfviewer", true);

				// Bind token.
				var handler = mediaStream.tokens.on(token, handleRequest, "pdfviewer");

				if (data.Type) {
					switch (data.Type) {
					case "FileInfo":
						console.log("Received PdfViewer file request", data);
						var subscope = $scope.$new();
						subscope.info = data.FileInfo;
						subscope.$on("downloadComplete", function(event) {
							event.stopPropagation();
						});
						subscope.$on("writeComplete", function(event, url, fileInfo) {
							event.stopPropagation();
							if (url.indexOf("blob:") === 0) {
								$scope.$emit("openPdf", url);
							} else {
								fileInfo.file.file(function(fp) {
									$scope.$emit("openPdf", fp);
								});
							}
						});
						handler = mediaStream.tokens.on(subscope.info.id, function(event, currenttoken, to, data, type, to2, from, xfer) {
							//console.log("PdfViewer token request", currenttoken, data, type);
							fileDownload.handleRequest($scope, xfer, data);
						}, "xfer");
						fileDownload.startDownload(subscope, from, subscope.info.id);
						break;

					case "Page":
						$scope.$emit("showPdfPage", data.Page);
						break;

					default:
						console.log("Received unknown PdfViewer event", data);
					}
				}
			});

			$scope.showPDFViewer = function() {
				console.log("PDF viewer active");
				if ($scope.layout.pdfviewer) {
					$scope.hidePDFViewer();
				}

				$scope.layout.pdfviewer = true;
				$scope.$emit("mainview", "pdfviewer", true);

				var peers = {};
				var pdfviewers = [];

				var connector = function(token, peercall) {
					console.log("XXX connector", token, peercall);
					if (peers.hasOwnProperty(peercall.id)) {
						// Already got a connection.
						return;
					}
					peers[peercall.id] = true;
					mediaStream.api.apply("sendPdfViewer", {
						send: function(type, data) {
							return peercall.peerconnection.send(data);
						}
					})(peercall.from, token);
				};

				// Create token to register with us and send token out to all peers.
				// Peers when connect to us with the token and we answer.
				var token = "pdfviewer_" + $scope.id + "_" + (pdfViewerCount++);

				// Updater function to bring in new calls.
				var updater = function(event, state, currentcall) {
					console.log("XXX updater", event, state, currentcall);
					switch (state) {
						case "completed":
						case "connected":
							connector(token, currentcall);
							break;
						case "closed":
							delete peers[currentcall.id];
							if (!peers.length) {
								console.log("All peers disconnected, stopping sharing");
								$scope.$apply(function(scope) {
									scope.hidePDFViewer();
								});
							}
							break;
					}
				};

				// Create callbacks are called for each incoming connections.
				handler = mediaStream.tokens.create(token, function(event, currenttoken, to, data, type, to2, from, peerpdfviewer) {
					console.log("PDF viewer create", currenttoken, data, type, peerpdfviewer);
					pdfviewers.push(peerpdfviewer);
					//usermedia.addToPeerConnection(peerscreenshare.peerconnection);
				}, "pdfviewer");

				// Connect all current calls.
				mediaStream.webrtc.callForEachCall(function(peercall) {
					connector(token, peercall);
				});
				// Catch later calls too.
				mediaStream.webrtc.e.on("statechange", updater);

				$scope.$on("pdfPageLoading", function(event, page) {
					_.each(peers, function(ignore, peerId) {
						var peercall = mediaStream.webrtc.findTargetCall(peerId);
						mediaStream.api.apply("sendPdfViewer", {
							send: function(type, data) {
								return peercall.peerconnection.send(data);
							}
						})(peerId, token, {
							Type: "Page",
							Page: page
						});
					});
				});

				// create drag-drop target
				var namespace = "file_" + $scope.id;
				var binder = fileUpload.bindDrop(namespace, $element, _.bind(function(files) {
					console.log("Files dragged", files);
					if (files.length > 1) {
						alertify.dialog.alert(translation._("Only single PDF documents can be shared at this time."));
						return;
					}

					_.each(files, _.bind(function(f) {
						var info = $.extend({
							id: f.id
						}, f.info);
						if (info.type !== "application/pdf") {
							console.log("Not sharing file", f, info);
							alertify.dialog.alert(translation._("Only PDF documents can be shared at this time."));
							return;
						}
						console.log("Advertising file", f, info);
						// TODO(fancycode): other peers should either request the file or subscribe rendered images (e.g. for mobile app), for now we send the whole file
						_.each(peers, function(ignore, peerId) {
							var peercall = mediaStream.webrtc.findTargetCall(peerId);
							mediaStream.api.apply("sendPdfViewer", {
								send: function(type, data) {
									return peercall.peerconnection.send(data);
								}
							})(peerId, token, {
								Type: "FileInfo",
								FileInfo: info
							});
						});
						var subscope = $scope.$new();
						subscope.info = info;
						var session = fileUpload.startUpload(subscope, info.id);
						// This binds the token to transfer and ui.
						var handler = mediaStream.tokens.on(info.id, function(event, currenttoken, to, data, type, to2, from, xfer) {
							//console.log("PdfViewer token request", currenttoken, data, type);
							session.handleRequest(subscope, xfer, data);
						}, "xfer");
						$scope.isPresenter = true;
						$scope.$emit("openPdf", f);
					}, this));
				}, this));
				binder.namespace = function() {
					// Inject own id into namespace.
					return namespace + "_" + $scope.myid;
				};

			};

			$scope.hidePDFViewer = function() {
				console.log("PDF viewer disabled");
				$scope.$emit("closePdf");
				$scope.layout.pdfviewer = false;
				$scope.isPresenter = false;
				$scope.$emit("mainview", "pdfviewer", false);
			};

			$scope.$watch("layout.pdfviewer", function(newval, oldval) {
				if (newval && !oldval) {
					$scope.showPDFViewer();
				} else if (!newval && oldval) {
					$scope.hidePDFViewer();
				}
			});

		}];

		return {
			restrict: 'E',
			replace: true,
			scope: true,
			template: template,
			controller: controller
		};

	}];

});
