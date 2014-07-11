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
define(['jquery', 'underscore', 'text!partials/presentation.html'], function($, _, template) {

	return ["$window", "mediaStream", "fileUpload", "fileDownload", "alertify", "translation", "randomGen", "fileData", function($window, mediaStream, fileUpload, fileDownload, alertify, translation, randomGen, fileData) {

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var presentationsCount = 0;
			var pane = $element.find(".presentationpane");
			var downloadProgressBar = $element.find(".progress-bar")[0];

			$scope.layout.presentation = false;
			$scope.isPresenter = false;
			$scope.hideControlsBar = true;
			$scope.pendingPageRequest = null;
			$scope.presentationLoaded = false;
			$scope.currentFileInfo = null;
			$scope.currentPage = null;
			$scope.receivedPage = null;
			$scope.loading = false;
			$scope.downloadSize = 0;
			$scope.downloadProgress = 0;
			$scope.sharedFilesCache = {};
			$scope.visibleSharedFiles = [];

			var addVisibleSharedFile = function(file) {
				if (file.writer) {
					// only show files the user has uploaded
					return;
				} else if ($scope.sharedFilesCache[file.info.id]) {
					// already added
					return;
				}
				$scope.visibleSharedFiles.push({
					"id": file.info.id,
					"name": file.info.name,
					"size": file.info.size,
					"file": file,
					"sortkey": (file.info.name || "").toLowerCase()
				});
			};

			var removeVisibleSharedFile = function(fileInfo) {
				var i;
				for (i=0; i<$scope.visibleSharedFiles.length; i++) {
					var file = $scope.visibleSharedFiles[i];
					if (file.id === fileInfo.id) {
						$scope.visibleSharedFiles.splice(i, 1);
						break;
					}
				}
			};

			$scope.resetProperties = function() {
				$scope.isPresenter = false;
				$scope.currentFileInfo = null;
				$scope.currentPage = null;
				$scope.receivedPage = null;
			};

			$scope.$on("pdfLoaded", function(event, source, doc) {
				$scope.currentPageNumber = -1;
				if ($scope.isPresenter) {
					$scope.$emit("showPdfPage", 1);
				} else if ($scope.pendingPageRequest !== null) {
					$scope.$emit("showPdfPage", $scope.pendingPageRequest);
					$scope.pendingPageRequest = null;
				} else {
					$scope.$emit("showQueuedPdfPage");
				}
				$scope.presentationLoaded = true;
			});

			$scope.$on("pdfLoadError", function(event, source, errorMessage, moreInfo) {
				$scope.loading = false;
				alertify.dialog.alert(errorMessage);
			});

			$scope.$watch("currentPageNumber", function(newval, oldval) {
				$scope.$emit("showPdfPage", newval);
			});

			var downloadScope = $scope.$new();
			downloadScope.$on("downloadedChunk", function(event, idx, byteLength, downloaded, total) {
				var percentage = Math.ceil((downloaded / total) * 100);
				$scope.downloadProgress = percentage;
				downloadProgressBar.style.width = percentage + '%';
			});
			downloadScope.$on("downloadComplete", function(event) {
				event.stopPropagation();
				$scope.downloadProgress = 100;
				downloadProgressBar.style.width = '100%';
				finishDownloadPresentation();
			});

			$scope.openFileInfo = function(fileInfo) {
				var url = fileInfo.url;
				if (url && url.indexOf("blob:") === 0) {
					$scope.$emit("openPdf", url);
				} else {
					var file = fileInfo.file;
					if (file.hasOwnProperty("writer")) {
						$scope.$emit("openPdf", file);
					} else {
						file.file(function(fp) {
							$scope.$emit("openPdf", fp);
						});
					}
				}
			};

			downloadScope.$on("writeComplete", function(event, url, fileInfo) {
				event.stopPropagation();
				$scope.downloadSize = 0;
				// need to store for internal file it and received token
				// to allow cleanup and prevent duplicate download
				fileInfo.url = url;
				$scope.sharedFilesCache[fileInfo.id] = fileInfo;
				$scope.sharedFilesCache[fileInfo.info.id] = fileInfo;
				addVisibleSharedFile(fileInfo);
				$scope.openFileInfo(fileInfo);
			});

			var finishDownloadPresentation = function() {
				if (downloadScope.info) {
					mediaStream.tokens.off(downloadScope.info.id, downloadScope.handler);
					downloadScope.info = null;
					downloadScope.handler = null;
				}
			};

			var downloadPresentation = function(fileInfo, from) {
				finishDownloadPresentation();

				$scope.presentationLoaded = false;
				$scope.pendingPageRequest = null;
				$scope.loading = true;

				var token = fileInfo.id;
				var existing = $scope.sharedFilesCache[token];
				if (existing) {
					console.log("Found existing file", existing);
					$scope.openFileInfo(existing);
					return;
				}

				downloadProgressBar.style.width = '0%';
				$scope.downloadProgress = 0;
				$scope.downloadSize = fileInfo.size;
				downloadScope.info = fileInfo;

				downloadScope.handler = mediaStream.tokens.on(token, function(event, currenttoken, to, data, type, to2, from, xfer) {
					//console.log("Presentation token request", currenttoken, data, type);
					fileDownload.handleRequest($scope, xfer, data);
				}, "xfer");

				fileDownload.startDownload(downloadScope, from, token);
			};

			var uploadPresentation = function(fileInfo) {
				var token = fileInfo.id;
				if ($scope.sharedFilesCache.hasOwnProperty(token)) {
					console.log("Already have an upload token for that presentation.");
					return;
				}

				var uploadScope = $scope.$new();
				uploadScope.info = fileInfo;
				var session = fileUpload.startUpload(uploadScope, token);
				// This binds the token to transfer and ui.
				uploadScope.handler = mediaStream.tokens.on(token, function(event, currenttoken, to, data, type, to2, from, xfer) {
					//console.log("Presentation token request", currenttoken, data, type);
					session.handleRequest(uploadScope, xfer, data);
				}, "xfer");
			};

			mediaStream.api.e.on("received.presentation", function(event, id, from, data, p2p) {
				if (!p2p) {
					console.warn("Received presentation info without p2p. This should not happen!");
					return;
				}

				if (data.Type) {
					switch (data.Type) {
					case "FileInfo":
						console.log("Received presentation file request", data);
						$scope.$apply(function(scope) {
							scope.resetProperties();
							if (data.FileInfo) {
								downloadPresentation(data.FileInfo, from);
							} else {
								// close currently visible PDF
								finishDownloadPresentation();
								$scope.$emit("closePdf");
								$scope.resetProperties();
								// TODO(fancycode): also cleanup downloaded file
							}
						});
						break;

					case "Show":
						console.log("Received presentation show request", data);
						$scope.$apply(function(scope) {
							if (!scope.layout.presentation) {
								scope.resetProperties();
								scope.layout.presentation = true;
							}
						});
						break;

					case "Hide":
						console.log("Received presentation hide request", data);
						$scope.$apply(function(scope) {
							scope.layout.presentation = false;
						});
						break;

					case "Page":
						$scope.$apply(function(scope) {
							scope.receivedPage = data.Page;
							if (!scope.presentationLoaded) {
								console.log("Queuing presentation page request, not loaded yet", data);
								scope.pendingPageRequest = data.Page;
							} else {
								console.log("Received presentation page request", data);
								scope.$emit("showPdfPage", data.Page);
							}
						});
						break;

					default:
						console.log("Received unknown presentation event", data);
					}
				}
			});

			var peers = {};
			var presentations = [];
			var currentToken = null;
			var tokenHandler = null;

			var mediaStreamSendPresentation = function(peercall, token, params) {
				mediaStream.api.apply("sendPresentation", {
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
				console.log("XXX connector", token, peercall, peers);
				if (peers.hasOwnProperty(peercall.id)) {
					// Already got a connection.
					return;
				}
				peers[peercall.id] = true;
				mediaStreamSendPresentation(peercall, token, {
					Type: "Show",
					Show: true
				});
				if ($scope.currentFileInfo !== null) {
					mediaStreamSendPresentation(peercall, token, {
						Type: "FileInfo",
						FileInfo: $scope.currentFileInfo
					});
				}
				if ($scope.currentPage !== null) {
					mediaStreamSendPresentation(peercall, token, {
						Type: "Page",
						Page: $scope.currentPage
					});
				}
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
							console.log("All peers disconnected, stopping presentation");
							$scope.$apply(function(scope) {
								scope.hidePresentation();
							});
						}
						break;
				}
			};

			$scope.$on("pdfPageLoading", function(event, page) {
				$scope.loading = false;
				$scope.currentPageNumber = page;
				if ($scope.receivedPage === page) {
					// we received this page request, don't publish to others
					$scope.receivedPage = null;
					return;
				}

				$scope.currentPage = page;
				mediaStream.webrtc.callForEachCall(function(peercall) {
					mediaStreamSendPresentation(peercall, currentToken, {
						Type: "Page",
						Page: page
					});
				});
			});

			$scope.$on("pdfPageLoadError", function(event, page, errorMessage) {
				$scope.loading = false;
				alertify.dialog.alert(errorMessage);
			});

			$scope.$on("pdfPageRenderError", function(event, pageNumber, maxPageNumber, errorMessage) {
				$scope.loading = false;
				alertify.dialog.alert(errorMessage);
			});

			$scope.startPresentingFile = function(file) {
				console.log("Advertising file", file);
				var fileInfo = file.info;
				// TODO(fancycode): other peers should either request the file or subscribe rendered images (e.g. for mobile app), for now we send the whole file
				mediaStream.webrtc.callForEachCall(function(peercall) {
					mediaStreamSendPresentation(peercall, currentToken, {
						Type: "FileInfo",
						FileInfo: fileInfo
					});
				});
				uploadPresentation(fileInfo);
				$scope.isPresenter = true;
				$scope.currentFileInfo = fileInfo;
				$scope.receivedPage = null;
				$scope.loading = true;
				$scope.$emit("openPdf", file);
				addVisibleSharedFile(file);
				$scope.sharedFilesCache[fileInfo.id] = file;
			};

			var filesSelected = function(files) {
				if (files.length > 1) {
					alertify.dialog.alert(translation._("Only single PDF documents can be shared at this time."));
					return;
				}

				_.each(files, function(f) {
					if (!f.info.hasOwnProperty("id")) {
						f.info.id = f.id;
					}
					if (f.info.type !== "application/pdf") {
						console.log("Not sharing file", f);
						alertify.dialog.alert(translation._("Only PDF documents can be shared at this time."));
						return;
					}
					$scope.startPresentingFile(f);
				});
			};

			// create drag-drop target
			var namespace = "file_" + $scope.id;
			var binder = fileUpload.bindDrop(namespace, $element, function(files) {
				console.log("Files dragged", files);
				filesSelected(files);
			});
			binder.namespace = function() {
				// Inject own id into namespace.
				return namespace + "_" + $scope.myid;
			};

			var clickBinder = fileUpload.bindClick(namespace, $element.find('.welcome button')[0], function(files) {
				console.log("Files selected", files);
				filesSelected(files);
			});
			clickBinder.namespace = function() {
				// Inject own id into namespace.
				return namespace + "_" + $scope.myid;
			};

			$scope.showPresentation = function() {
				console.log("Presentation active");
				$scope.layout.presentation = true;
				$scope.$emit("mainview", "presentation", true);

				if (currentToken) {
					mediaStream.tokens.off(currentToken, tokenHandler);
				}

				// Create token to register with us and send token out to all peers.
				// Peers when connect to us with the token and we answer.
				currentToken = "presentation_" + $scope.id + "_" + (presentationsCount++);

				// Create callbacks are called for each incoming connections.
				tokenHandler = mediaStream.tokens.create(currentToken, function(event, currenttoken, to, data, type, to2, from, peerpresentation) {
					console.log("Presentation create", currenttoken, data, type, peerpresentation);
					presentations.push(peerpresentation);
					//usermedia.addToPeerConnection(peerscreenshare.peerconnection);
				}, "presentation");

				// Connect all current calls.
				mediaStream.webrtc.callForEachCall(function(peercall) {
					connector(currentToken, peercall);
				});
				// Catch later calls too.
				mediaStream.webrtc.e.on("statechange", updater);
			};

			$scope.hidePresentation = function() {
				console.log("Presentation disabled");
				if (currentToken) {
					mediaStream.webrtc.callForEachCall(function(peercall) {
						mediaStreamSendPresentation(peercall, currentToken, {
							Type: "Hide",
							Hide: true
						});
					});
					mediaStream.tokens.off(currentToken, tokenHandler);
					currentToken = null;
				}
				$scope.$emit("closePdf");
				finishDownloadPresentation();
				$scope.resetProperties();
				$scope.layout.presentation = false;
				peers = {};
				$scope.$emit("mainview", "presentation", false);
				mediaStream.webrtc.e.off("statechange", updater);
			};

			$scope.selectPresentation = function(fileInfo) {
				if ($scope.currentFileInfo && fileInfo.id === $scope.currentFileInfo.id) {
					// switch back to first page when clicked on current presentation
					$scope.$emit("showPdfPage", 1);
					return;
				}
				console.log("Selected", fileInfo);
				$scope.startPresentingFile(fileInfo.file);
			};

			$scope.deletePresentation = function($event, fileInfo) {
				$event.preventDefault();
				var token = fileInfo.id;
				fileData.purgeFile(token);
				delete $scope.sharedFilesCache[token];
				if (fileInfo.info) {
					delete $scope.sharedFilesCache[fileInfo.info.id];
				}
				removeVisibleSharedFile(fileInfo);
				mediaStream.tokens.off(token);
				if ($scope.currentFileInfo && fileInfo.id === $scope.currentFileInfo.id) {
					mediaStream.webrtc.callForEachCall(function(peercall) {
						mediaStreamSendPresentation(peercall, currentToken, {
							Type: "FileInfo",
							FileInfo: null
						});
					});
					$scope.$emit("closePdf");
					$scope.resetProperties($scope.visibleSharedFiles.length > 0);
				}
			};

			mediaStream.webrtc.e.on("done", function() {
				_.each($scope.sharedFilesCache, function(file, id) {
					fileData.purgeFile(id);
				});
				$scope.sharedFilesCache = {};
				$scope.visibleSharedFiles = [];
			});

			$(document).on("keyup", function(event) {
				if (!$scope.layout.presentation) {
					return;
				}
				if ($(event.target).is("input,textarea,select")) {
					return;
				}
				$scope.$apply(function() {
					switch (event.keyCode) {
					case 37:
						// left arrow
						$scope.$emit("prevPage");
						event.preventDefault();
						break;
					case 39:
						// right arrow
					case 32:
						// space
						$scope.$emit("nextPage");
						event.preventDefault();
						break;
					}
				});
			});

			$scope.$watch("layout.presentation", function(newval, oldval) {
				if (newval && !oldval) {
					$scope.showPresentation();
				} else if (!newval && oldval) {
					$scope.hidePresentation();
				}
			});

			$($window).on("resize", function() {
				$scope.$emit("redrawPdf");
			});

			$scope.$watch("layout.main", function(newval, oldval) {
				console.log("presentation main", newval);
				if (newval && newval !== "presentation") {
					$scope.hidePresentation();
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
