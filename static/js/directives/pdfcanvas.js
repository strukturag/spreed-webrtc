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
define(['require', 'underscore', 'jquery'], function(require, _, $) {

	return ["$window", "$compile", "$http", "translation", "safeApply", 'restURL', 'sandbox', function($window, $compile, $http, translation, safeApply, restURL, sandbox) {

		var pdfjs = null;

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var container = $($element);
			var pdfCanvas;
			var url = restURL.sandbox("pdfcanvas");
			var sandboxApi = sandbox.createSandbox(container, null, url, "allow-scripts", null, {
				allowfullscreen: true,
				mozallowfullscreen: true,
				webkitallowfullscreen: true
			});

			sandboxApi.e.on("message", function(event, message) {
				var msg = message.data;
				var data = msg[msg.type] || {};
				switch (msg.type) {
				case "ready":
					break;
				case "pdfjs.loading":
					$scope.$apply(function(scope) {
						scope.$emit("presentationLoading", data.source);
					});
					break;
				case "pdfjs.loaded":
					pdfCanvas._pdfLoaded(data.source, data.doc);
					break;
				case "pdfjs.loadError":
					pdfCanvas._pdfLoadError(data.source, data.error);
					break;
				case "pdfjs.pageLoaded":
					pdfCanvas._pageLoaded(data.page);
					break;
				case "pdfjs.pageLoadError":
					pdfCanvas._pageLoadError(data.page, data.error);
					break;
				case "pdfjs.renderingPage":
					$scope.$apply(function(scope) {
						scope.$emit("presentationPageRendering", data.page);
					});
					break;
				case "pdfjs.pageRendered":
					pdfCanvas._pageRendered(data.page);
					break;
				case "pdfjs.pageRenderError":
					pdfCanvas._pageRenderError(data.page, data.error);
					break;
				case "pdfjs.keyUp":
					$scope.$apply(function(scope) {
						scope.$emit("keyUp", data.key);
					});
					break;
				default:
					console.log("Unknown message received", message);
					break;
				}
			});

			var PDFCanvas = function(scope) {
				this.scope = scope;
				this.doc = null;
				this.currentPageNumber = null;
				this.pendingPageNumber = null;
				this.url = null;
			};

			PDFCanvas.prototype.close = function() {
				sandboxApi.postMessage("closeFile", {"close": true});
				if (this.url) {
					URL.revokeObjectURL(this.url);
					this.url = null;
				}
				this.pendingPageNumber = null;
				this.currentPageNumber = -1;
				this.maxPageNumber = -1;
			};

			PDFCanvas.prototype.open = function(presentation) {
				this.scope.$emit("presentationOpening", presentation);
				presentation.open(_.bind(function(source) {
					console.log("Loading PDF from", source);
					this.close();
					if (typeof source === "string") {
						// got a url
						this._openFile(source);
						return;
					}

					var fp = source.file || source;
					if (typeof URL !== "undefined" && URL.createObjectURL) {
						this.url = URL.createObjectURL(fp);
						this._openFile(this.url);
					} else {
						var fileReader = new FileReader();
						fileReader.onload = _.bind(function(evt) {
							var buffer = evt.target.result;
							var uint8Array = new Uint8Array(buffer);
							this._openFile(uint8Array);
						}, this);
						fileReader.readAsArrayBuffer(fp);
					}
				}, this));
			};

			PDFCanvas.prototype._pdfLoaded = function(source, doc) {
				this.scope.$apply(_.bind(function(scope) {
					this.doc = doc;
					this.maxPageNumber = doc.numPages;
					this.currentPageNumber = -1;
					scope.$emit("presentationLoaded", source, doc);
				}, this));
			};

			PDFCanvas.prototype._pdfLoadError = function(source, error, exception) {
				var loadErrorMessage;
				switch (error) {
				case "InvalidPDFException":
					loadErrorMessage = translation._("Could not load PDF: Please make sure to select a PDF document.");
					break;
				case "MissingPDFException":
					loadErrorMessage = translation._("Could not load PDF: Missing PDF file.");
					break;
				default:
					if (error) {
						loadErrorMessage = translation._("An error occurred while loading the PDF (%s).", error);
					} else {
						loadErrorMessage = translation._("An unknown error occurred while loading the PDF.");
					}
					break;
				}
				this.scope.$apply(_.bind(function(scope) {
					scope.$emit("presentationLoadError", source, loadErrorMessage);
				}, this));
			};

			PDFCanvas.prototype._openFile = function(source) {
				if (typeof(source) === "string") {
					// we can't load urls from inside the sandbox, do so here and transmit the contents
					$http.get(source, {
						responseType: "arraybuffer"
					}).then(_.bind(function(response) {
						this._openFile(response.data);
					}, this), _.bind(function(error) {
						this._pdfLoadError(source, error);
					}, this));
					return;
				}

				console.log("Opening file", source);
				sandboxApi.postMessage("openFile", {"source": source});
			};

			PDFCanvas.prototype._pageLoaded = function(page) {
				this.scope.$apply(_.bind(function(scope) {
					scope.$emit("presentationPageLoaded", page);
				}, this));
			};

			PDFCanvas.prototype._pageLoadError = function(page, error) {
				var loadErrorMessage;
				if (error) {
					loadErrorMessage = translation._("An error occurred while loading the PDF page (%s).", error);
				} else {
					loadErrorMessage = translation._("An unknown error occurred while loading the PDF page.");
				}
				this.scope.$apply(_.bind(function(scope) {
					scope.$emit("presentationPageLoadError", page, loadErrorMessage);
				}, this));
			};

			PDFCanvas.prototype._showPage = function(page) {
				if (page === this.currentPageNumber) {
					return;
				}

				console.log("Showing page", page, "/", this.maxPageNumber);
				this.currentPageNumber = page;
				this.scope.$emit("presentationPageLoading", page);
				sandboxApi.postMessage("loadPage", {"page": page});
			};

			PDFCanvas.prototype._pageRendered = function(page) {
				this.scope.$apply(_.bind(function(scope) {
					this.scope.$emit("presentationPageRendered", page, this.maxPageNumber);
					this.showQueuedPage();
				}, this));
			};

			PDFCanvas.prototype._pageRenderError = function(page, error) {
				var loadErrorMessage;
				if (error) {
					loadErrorMessage = translation._("An error occurred while rendering the PDF page (%s).", error);
				} else {
					loadErrorMessage = translation._("An unknown error occurred while rendering the PDF page.");
				}
				this.scope.$apply(_.bind(function(scope) {
					scope.$emit("presentationPageRenderError", page, this.maxPageNumber, loadErrorMessage);
				}, this));
			};

			PDFCanvas.prototype.redrawPage = function() {
				sandboxApi.postMessage("redrawPage", {"redraw": true});
			};

			PDFCanvas.prototype.showPage = function(page) {
				if (page >= 1 && page <= this.maxPageNumber) {
					if (!this.doc) {
						this.pendingPageNumber = page;
				   } else {
						this._showPage(page);
				   }
				}
			};

			PDFCanvas.prototype.showQueuedPage = function() {
				if (this.pendingPageNumber !== null) {
					this._showPage(this.pendingPageNumber);
					this.pendingPageNumber = null;
				}
			};

			pdfCanvas = new PDFCanvas($scope);

			$scope.$watch("currentPresentation", function(presentation, previousPresentation) {
				if (presentation) {
					safeApply($scope, function(scope) {
						pdfCanvas.open(presentation);
					});
				} else {
					if (previousPresentation) {
						previousPresentation.close();
					}
					pdfCanvas.close();
				}
			});

			$scope.$on("$destroy", function() {
				pdfCanvas.close();
				pdfCanvas = null;
				sandboxApi.destroy();
			});

			$scope.$watch("currentPageNumber", function(page, oldValue) {
				if (page === oldValue) {
					// no change
					return;
				}

				pdfCanvas.showPage(page);
			});

			$($window).on("resize", function() {
				$scope.$apply(function(scope) {
					pdfCanvas.redrawPage();
				});
			});

		}];

		return {
			restrict: 'E',
			replace: true,
			template: '<div class="canvasContainer"></div>',
			controller: controller
		};

	}];

});
