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

"use strict";
define(['require', 'underscore', 'jquery'], function(require, _, $) {

	return ["$window", "$compile", "translation", "safeApply", function($window, $compile, translation, safeApply) {

		var webodf = null;

		var DOCUMENT_TYPE_PRESENTATION = "presentation";
		var DOCUMENT_TYPE_SPREADSHEET = "spreadsheet";
		var DOCUMENT_TYPE_TEXT = "text";

		var nsResolver = function(prefix) {
			var ns = {
				'draw': "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
				'presentation': "urn:oasis:names:tc:opendocument:xmlns:presentation:1.0",
				'text': "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
				'office': "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
			};
			return ns[prefix] || console.log('prefix [' + prefix + '] unknown.');
		}

		var ODFCanvas_readFile = function(path, encoding, callback) {
			if (typeof path === "string") {
				webodf.runtime.orig_readFile.call(webodf.runtime, path, encoding, callback);
				return;
			}

			var fp = path.file || path;
			if (typeof URL !== "undefined" && URL.createObjectURL) {
				var url = URL.createObjectURL(fp);
				webodf.runtime.orig_readFile.call(webodf.runtime, url, encoding, function() {
					URL.revokeObjectURL(url);
					callback.apply(callback, arguments);
				});
				return;
			}

			console.error("TODO(fancycode): implement readFile for", path);
		};

		var ODFCanvas_loadXML = function(path, callback) {
			if (typeof path === "string") {
				webodf.runtime.orig_loadXML.call(webodf.runtime, path, callback);
				return;
			}

			var fp = path.file || path;
			if (typeof URL !== "undefined" && URL.createObjectURL) {
				var url = URL.createObjectURL(fp);
				webodf.runtime.orig_loadXML.call(webodf.runtime, url, function() {
					URL.revokeObjectURL(url);
					callback.apply(callback, arguments);
				});
				return;
			}

			console.error("TODO(fancycode): implement loadXML for", path);
		};

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var ODFCanvas = function(scope, container, canvasDom) {
				this.scope = scope;
				this.container = container;
				this.canvasDom = canvasDom;
				this.canvas = null;
				this.maxPageNumber = -1;
				this.currentPageNumber = -1;
				this.pendingPageNumber = null;
			};

			ODFCanvas.prototype._close = function() {
				if (this.canvas) {
					this.canvas.destroy(function() {
						// ignore callback
					});
					this.canvas = null;
				}
				this.maxPageNumber = -1;
				this.currentPageNumber = -1;
				this.pendingPageNumber = null;
			};

			ODFCanvas.prototype.close = function() {
				this._close();
			};

			ODFCanvas.prototype.open = function(presentation) {
				this.scope.$emit("presentationOpening", presentation);
				presentation.open(_.bind(function(source) {
					console.log("Loading ODF from", source);
					this._openFile(source);
				}, this));
			};

			ODFCanvas.prototype._odfLoaded = function() {
				this.scope.$apply(_.bind(function(scope) {
					var odfcontainer = this.canvas.odfContainer();
					this.document_type = odfcontainer.getDocumentType();
					// pages only supported for presentations
					var pages = [];
					switch (this.document_type) {
					case DOCUMENT_TYPE_PRESENTATION:
						pages = odfcontainer.rootElement.getElementsByTagNameNS(nsResolver('draw'), 'page');
						this.container.addClass("showonepage");
						break;

					default:
						this.container.removeClass("showonepage");
						break;
					}

					this.maxPageNumber = Math.max(1, pages.length);
					this.currentPageNumber = -1;
					console.log("ODF loaded", odfcontainer);
					var odfDoc = {
						numPages: this.maxPageNumber
					};
					scope.$emit("presentationLoaded", odfcontainer.getUrl(), odfDoc);
					if (this.pendingPageNumber !== null) {
						this._showPage(this.pendingPageNumber);
						this.pendingPageNumber = null;
					}
				}, this));
			};

			ODFCanvas.prototype._doOpenFile = function(source) {
				this.scope.$emit("presentationLoading", source);
				this.container.hide();
				if (!this.canvas) {
					this.canvas = new webodf.odf.OdfCanvas(this.canvasDom[0]);
					this.canvas.addListener("statereadychange", _.bind(function() {
						this._odfLoaded();
					}, this));
				}

				this.canvas.setZoomLevel(1);
				this.canvas.load(source);
			};

			ODFCanvas.prototype._openFile = function(source) {
				if (webodf === null) {
					// load webodf.js lazily
					require(['webodf'], _.bind(function(webodf_) {
						console.log("Using webodf.js " + webodf_.webodf.Version);

						webodf = webodf_;

						// monkey-patch IO functions
						webodf.runtime.orig_readFile = webodf.runtime.readFile;
						webodf.runtime.readFile = ODFCanvas_readFile;
						webodf.runtime.orig_loadXML = webodf.runtime.loadXML;
						webodf.runtime.loadXML = ODFCanvas_loadXML;

						this.scope.$apply(_.bind(function(scope) {
							this._doOpenFile(source);
						}, this));
					}, this));
				} else {
					this._doOpenFile(source);
				}
			};

			ODFCanvas.prototype._showPage = function(page) {
				if (page === this.currentPageNumber) {
					return;
				}

				console.log("Showing page", page, "/", this.maxPageNumber);
				this.scope.$emit("presentationPageLoading", page);
				this.scope.$emit("presentationPageLoaded", page, null);
				// actual rendering of first page must happen after the
				// previously hidden DOM elements are visible again to
				// make initial scaling work, so defer it
				_.defer(_.bind(function() {
					this.scope.$apply(_.bind(function() {
						if (this.currentPageNumber === -1) {
							this.container.show();
							this.redrawPage();
						}
						this.currentPageNumber = page;
						this.canvas.showPage(page);
						this.scope.$emit("presentationPageRendering", page);
						this.scope.$emit("presentationPageRendered", page, this.maxPageNumber);
					}, this));
				}, this));
			};

			ODFCanvas.prototype.redrawPage = function() {
				if (this.canvas) {
					switch (this.document_type) {
					case DOCUMENT_TYPE_PRESENTATION:
						this.canvas.fitToContainingElement(this.container.width(), this.container.height());
						break;

					default:
						this.canvas.fitToWidth(this.container.width());
						break;
					}
				}
			};

			ODFCanvas.prototype.showPage = function(page) {
				if (page >= 1 && page <= this.maxPageNumber) {
					if (!this.canvas) {
						this.pendingPageNumber = page;
					} else {
						this._showPage(page);
					}
				}
			};

			var container = $($element);
			var canvas = $($element).find(".odfcanvas");
			var odfCanvas = new ODFCanvas($scope, container, canvas);

			$scope.$watch("currentPresentation", function(presentation, previousPresentation) {
				if (presentation) {
					safeApply($scope, function(scope) {
						odfCanvas.open(presentation);
					});
				} else {
					if (previousPresentation) {
						previousPresentation.close();
					}
					odfCanvas.close();
				}
			});

			$scope.$on("$destroy", function() {
				odfCanvas.close();
				odfCanvas = null;
			});

			$scope.$watch("currentPageNumber", function(page, oldValue) {
				if (page === oldValue) {
					// no change
					return;
				}

				odfCanvas.showPage(page);
			});

			$($window).on("resize", function() {
				$scope.$apply(function(scope) {
					odfCanvas.redrawPage();
				});
			});

		}];

		return {
			restrict: 'E',
			replace: true,
			template: '<div class="canvasContainer odfcontainer"><div class="odfcanvas"></div></div>',
			controller: controller
		};

	}];

});
