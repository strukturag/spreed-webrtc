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
define(['require', 'underscore', 'jquery', 'pdf'], function(require, _, $, pdf) {

	pdf.workerSrc = require.toUrl('pdf.worker') + ".js";

	return ["$compile", function($compile) {

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var PDFCanvas = function(scope, scale, canvases) {
				this.scope = scope;
				this.canvases = canvases;
				this.doc = null;
				this.rendering = false;
				this.scale = scale;
				this.currentPage = null;
				this.pendingPageNumber = null;
			};

			PDFCanvas.prototype.close = function() {
				if (this.currentPage) {
					this.currentPage.destroy();
					this.currentPage = null;
				}
				if (this.doc) {
					this.doc.cleanup();
					this.doc.destroy();
					this.doc = null;
				}
				this.rendering = false;
				this.pendingPageNumber = null;
				this.scope.currentPageNumber = -1;
				this.scope.maxPageNumber = -1;
				// clear visible canvas so it's empty when we show the next document
				var canvas = this.canvases[this.scope.canvasIndex];
				canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
				this.scope.$emit("pdfClosed");
			};

			PDFCanvas.prototype.open = function(file) {
				console.log("Loading PDF from", file);
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

			PDFCanvas.prototype._openFile = function(source) {
				this.scope.$emit("pdfLoading", source);
				pdf.getDocument(source).then(_.bind(function(doc) {
					this.scope.$apply(_.bind(function(scope) {
						this.doc = doc;
						scope.maxPageNumber = doc.numPages;
						scope.currentPageNumber = -1;
						console.log("PDF loaded", doc);
						scope.$emit("pdfLoaded", source, doc);
					}, this));
				}, this));
			};

			PDFCanvas.prototype._showPage = function(page) {
				if (page === this.scope.currentPageNumber) {
					return;
				}

				console.log("Showing page", page, "/", this.scope.maxPageNumber);
				if (this.currentPage) {
					this.currentPage.destroy();
					this.currentPage = null;
				}
				this.rendering = true;
				this.scope.currentPageNumber = page;
				this.scope.$emit("pdfPageLoading", page);
				this.doc.getPage(page).then(_.bind(function(pageObject) {
					console.log("Got page", pageObject);
					this.scope.$emit("pdfPageLoaded", page, pageObject);
					this.currentPage = pageObject;
					var viewport = pageObject.getViewport(this.scale);
					// use double-buffering to avoid flickering while
					// the new page is rendered...
					var canvas = this.canvases[1 - this.scope.canvasIndex];
					canvas.width = viewport.width;
					canvas.height = viewport.height;
					var renderContext = {
						canvasContext: canvas.getContext("2d"),
						viewport: viewport
					};

					console.log("Rendering page", pageObject);
					this.scope.$emit("pdfPageRendering", page);
					// TODO(fancycode): also render images in different resolutions for subscribed peers and send to them when ready
					var renderTask = pageObject.render(renderContext);
					renderTask.promise.then(_.bind(function() {
						this.scope.$apply(_.bind(function(scope) {
							console.log("Rendered page", page);
							this.scope.$emit("pdfPageRendered", page, scope.maxPageNumber);
							this.rendering = false;
							// ...and flip the buffers...
							scope.canvasIndex = 1 - scope.canvasIndex;
							this.showQueuedPage();
						}, this));
					}, this));
				}, this));
			};

			PDFCanvas.prototype.showPage = function(page) {
				if (page >= 1 && page <= this.scope.maxPageNumber) {
					if (!this.doc || this.rendering) {
						this.pendingPageNumber = page;
				   } else {
						this._showPage(page);
				   }
				}
			};

			PDFCanvas.prototype.prevPage = function() {
				this.showPage(this.scope.currentPageNumber - 1);
			};

			PDFCanvas.prototype.nextPage = function() {
				this.showPage(this.scope.currentPageNumber + 1);
			};

			PDFCanvas.prototype.showQueuedPage = function() {
				if (this.pendingPageNumber !== null) {
					this._showPage(this.pendingPageNumber);
					this.pendingPageNumber = null;
				}
			};

			$scope.currentPageNumber = -1;
			$scope.maxPageNumber = -1;
			$scope.canvasIndex = 0;

			var canvases = $element.find("canvas");
			var scale = 0.8;
			var pdfCanvas = new PDFCanvas($scope, scale, canvases);

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

			$scope.prevPage = function() {
				pdfCanvas.prevPage();
			};

			$scope.nextPage = function() {
				pdfCanvas.nextPage();
			};

		}];

		return {
			restrict: 'E',
			replace: true,
			template: '<span><canvas ng-hide="canvasIndex"></canvas><canvas ng-show="canvasIndex"></canvas></span>',
			controller: controller
		};

	}];

});
