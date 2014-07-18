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
define(['require', 'underscore', 'jquery'], function(require, _, $) {

	return ["$compile", "translation", function($compile, translation) {

		var pdfjs = null;

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var container = $($element);

			var PDFCanvas = function(scope, canvases) {
				this.scope = scope;
				this.canvases = canvases;
				this.doc = null;
				this.currentPage = null;
				this.currentPageNumber = null;
				this.pendingPageNumber = null;
				this.renderTask = null;
			};

			PDFCanvas.prototype._close = function() {
				this._stopRendering();
				if (this.currentPage) {
					this.currentPage.destroy();
					this.currentPage = null;
				}
				if (this.doc) {
					this.doc.cleanup();
					this.doc.destroy();
					this.doc = null;
				}
				this.pendingPageNumber = null;
				this.currentPageNumber = -1;
				this.maxPageNumber = -1;
				// clear visible canvas so it's empty when we show the next document
				var canvas = this.canvases[this.scope.canvasIndex];
				canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
			};

			PDFCanvas.prototype.close = function() {
				this._close();
				this.scope.$emit("pdfClosed");
			};

			PDFCanvas.prototype.open = function(file) {
				console.log("Loading PDF from", file);
				this._close();
				if (typeof file === "string") {
					// got a url
					this._openFile(file);
					return;
				}

				var fp = file.file || file;
				if (typeof URL !== "undefined" && URL.createObjectURL) {
					var url = URL.createObjectURL(fp);
					this._openFile(url);
				} else {
					var fileReader = new FileReader();
					fileReader.onload = _.bind(function(evt) {
						var buffer = evt.target.result;
						var uint8Array = new Uint8Array(buffer);
						this._openFile(uint8Array);
					}, this);
					fileReader.readAsArrayBuffer(fp);
				}
			};

			PDFCanvas.prototype._pdfLoaded = function(source, doc) {
				this.scope.$apply(_.bind(function(scope) {
					this.doc = doc;
					this.maxPageNumber = doc.numPages;
					this.currentPageNumber = -1;
					console.log("PDF loaded", doc);
					scope.$emit("pdfLoaded", source, doc);
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
					scope.$emit("pdfLoadError", source, loadErrorMessage);
				}, this));
			};

			PDFCanvas.prototype._doOpenFile = function(source) {
				pdfjs.getDocument(source).then(_.bind(function(doc) {
					this._pdfLoaded(source, doc);
				}, this), _.bind(function(error, exception) {
					this._pdfLoadError(source, error, exception);
				}, this));
			};

			PDFCanvas.prototype._openFile = function(source) {
				this.scope.$emit("pdfLoading", source);
				if (pdfjs === null) {
					// load pdf.js lazily
					require(['pdf'], _.bind(function(pdf) {
						pdf.workerSrc = require.toUrl('pdf.worker') + ".js";

						console.log("Using pdf.js " + pdf.version + " (build " + pdf.build + ")");

						pdfjs = pdf;

						this._doOpenFile(source);
					}, this));
				} else {
					this._doOpenFile(source);
				}
			};

			PDFCanvas.prototype._pageLoaded = function(page, pageObject) {
				console.log("Got page", pageObject);
				this.scope.$emit("pdfPageLoaded", page, pageObject);
				this.currentPage = pageObject;
				this.drawPage(pageObject);
			};

			PDFCanvas.prototype._pageLoadError = function(page, error, exception) {
				console.error("Could not load page", page, error, exception);
				var loadErrorMessage;
				if (error) {
					loadErrorMessage = translation._("An error occurred while loading the PDF page (%s).", error);
				} else {
					loadErrorMessage = translation._("An unknown error occurred while loading the PDF page.");
				}
				this.scope.$emit("pdfPageLoadError", page, loadErrorMessage);
			};

			PDFCanvas.prototype._showPage = function(page) {
				if (page === this.currentPageNumber) {
					return;
				}

				console.log("Showing page", page, "/", this.maxPageNumber);
				if (this.currentPage) {
					this.currentPage.destroy();
					this.currentPage = null;
				}
				this.currentPageNumber = page;
				this.scope.$emit("pdfPageLoading", page);
				this.doc.getPage(page).then(_.bind(function(pageObject) {
					this._pageLoaded(page, pageObject);
				}, this), _.bind(function(error, exception) {
					this._pageLoadError(page, error, exception);
				}, this));
			};

			PDFCanvas.prototype._pageRendered = function(pageObject) {
				this.renderTask = null;
				this.scope.$apply(_.bind(function(scope) {
					console.log("Rendered page", pageObject.pageNumber);
					this.scope.$emit("pdfPageRendered", pageObject.pageNumber, this.maxPageNumber);
					// ...and flip the buffers...
					scope.canvasIndex = 1 - scope.canvasIndex;
					this.showQueuedPage();
				}, this));
			};

			PDFCanvas.prototype._pageRenderError = function(pageObject, error, exception) {
				if (error === "cancelled") {
					return;
				}
				console.error("Could not render page", pageObject, error, exception);
				this.renderTask = null;
				var loadErrorMessage;
				if (error) {
					loadErrorMessage = translation._("An error occurred while rendering the PDF page (%s).", error);
				} else {
					loadErrorMessage = translation._("An unknown error occurred while rendering the PDF page.");
				}
				this.scope.$apply(_.bind(function(scope) {
					this.scope.$emit("pdfPageRenderError", pageObject.pageNumber, this.maxPageNumber, loadErrorMessage);
				}, this));
			};

			PDFCanvas.prototype._stopRendering = function() {
				if (this.renderTask) {
					if (this.renderTask.internalRenderTask && this.renderTask.internalRenderTask.cancel) {
						this.renderTask.internalRenderTask.cancel();
					}
					this.renderTask = null;
				}
			}

			PDFCanvas.prototype.drawPage = function(pageObject) {
				var pdfView = pageObject.view;
				var pdfWidth = pdfView[2] - pdfView[0];
				var pdfHeight = pdfView[3] - pdfView[1];
				var w = container.width();
				var h = container.height();
				var scale = w / pdfWidth;
				if (pdfHeight * scale > h) {
					scale = container.height() / pdfHeight;
				}

				// use double-buffering to avoid flickering while
				// the new page is rendered...
				var canvas = this.canvases[1 - this.scope.canvasIndex];
				var viewport = pageObject.getViewport(scale);
				canvas.width = Math.round(viewport.width);
				canvas.height = Math.round(viewport.height);
				var renderContext = {
					canvasContext: canvas.getContext("2d"),
					viewport: viewport
				};

				console.log("Rendering page", pageObject);
				this.scope.$emit("pdfPageRendering", pageObject.pageNumber);

				// TODO(fancycode): also render images in different resolutions for subscribed peers and send to them when ready
				this._stopRendering();
				var renderTask = pageObject.render(renderContext);
				this.renderTask = renderTask;
				renderTask.promise.then(_.bind(function() {
					this._pageRendered(pageObject);
				}, this), _.bind(function(error, exception) {
					this._pageRenderError(pageObject, error, exception);
				}, this));
			};

			PDFCanvas.prototype.redrawPage = function() {
				if (this.currentPage !== null) {
					this.drawPage(this.currentPage);
				}
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

			PDFCanvas.prototype.prevPage = function() {
				this.showPage(this.currentPageNumber - 1);
			};

			PDFCanvas.prototype.nextPage = function() {
				this.showPage(this.currentPageNumber + 1);
			};

			PDFCanvas.prototype.showQueuedPage = function() {
				if (this.pendingPageNumber !== null) {
					this._showPage(this.pendingPageNumber);
					this.pendingPageNumber = null;
				}
			};

			$scope.canvasIndex = 0;

			var canvases = container.find("canvas");
			var pdfCanvas = new PDFCanvas($scope, canvases);

			$scope.$on("openPdf", function(event, source) {
				pdfCanvas.open(source);
			});

			$scope.$on("closePdf", function() {
				pdfCanvas.close();
			});

			$scope.$on("$destroy", function() {
				pdfCanvas.close();
				pdfCanvas = null;
			});

			$scope.$on("showPdfPage", function(event, page) {
				pdfCanvas.showPage(page);
			});

			$scope.$on("showQueuedPdfPage", function() {
				pdfCanvas.showQueuedPage();
			});

			$scope.$on("redrawPdf", function() {
				pdfCanvas.redrawPage();
			});

			$scope.$on("prevPage", function() {
				pdfCanvas.prevPage();
			});

			$scope.$on("nextPage", function() {
				pdfCanvas.nextPage();
			});

			$scope.prevPage = function() {
				$scope.$emit("prevPage");
			};

			$scope.nextPage = function() {
				$scope.$emit("nextPage");
			};

		}];

		return {
			restrict: 'E',
			replace: true,
			template: '<div class="canvasContainer"><canvas ng-hide="canvasIndex"></canvas><canvas ng-show="canvasIndex"></canvas></div>',
			controller: controller
		};

	}];

});
