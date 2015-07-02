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

	return ["$window", "$compile", "$http", "translation", "safeApply", "restURL", "sandbox", function($window, $compile, $http, translation, safeApply, restURL, sandbox) {

		var DOCUMENT_TYPE_PRESENTATION = "presentation";
		var DOCUMENT_TYPE_SPREADSHEET = "spreadsheet";
		var DOCUMENT_TYPE_TEXT = "text";

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var container = $($element);
			var odfCanvas;
			var url = restURL.sandbox("odfcanvas");
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
				case "webodf.loading":
					$scope.$apply(function(scope) {
						scope.$emit("presentationLoading", data.source);
						container.hide();
					});
					break;
				case "webodf.loaded":
					odfCanvas._odfLoaded(data.url, data.type, data.numPages);
					break;
				case "webodf.keyUp":
					$scope.$apply(function(scope) {
						scope.$emit("keyUp", data.key);
					});
					break;
				default:
					console.log("Unknown message received", message);
					break;
				}
			});

			var ODFCanvas = function(scope, container) {
				this.scope = scope;
				this.container = container;
				this.doc = null;
				this.maxPageNumber = -1;
				this.currentPageNumber = -1;
				this.pendingPageNumber = null;
			};

			ODFCanvas.prototype.close = function() {
				sandboxApi.postMessage("closeFile", {"close": true});
				this.maxPageNumber = -1;
				this.currentPageNumber = -1;
				this.pendingPageNumber = null;
				this.doc = null;
			};

			ODFCanvas.prototype.open = function(presentation) {
				this.scope.$emit("presentationOpening", presentation);
				presentation.open(_.bind(function(source) {
					console.log("Loading ODF from", source);
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

			ODFCanvas.prototype._odfLoaded = function(url, document_type, numPages) {
				this.scope.$apply(_.bind(function(scope) {
					this.document_type = document_type;
					switch (document_type) {
					case DOCUMENT_TYPE_PRESENTATION:
						this.container.addClass("showonepage");
						break;

					default:
						this.container.removeClass("showonepage");
						break;
					}

					this.maxPageNumber = numPages;
					this.currentPageNumber = -1;
					this.doc = {
						numPages: this.maxPageNumber
					};
					scope.$emit("presentationLoaded", url, this.doc);
					if (this.pendingPageNumber !== null) {
						this._showPage(this.pendingPageNumber);
						this.pendingPageNumber = null;
					}
				}, this));
			};

			ODFCanvas.prototype._openFile = function(source) {
				if (typeof(source) === "string") {
					// we can't load urls from inside the sandbox, do so here and transmit the contents
					$http.get(source, {
						responseType: "arraybuffer"
					}).then(_.bind(function(response) {
						this._openFile(response.data);
					}, this));
					return;
				}

				console.log("Opening file", source);
				sandboxApi.postMessage("openFile", {"source": source});
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
						sandboxApi.postMessage("showPage", {"page": page});
						this.scope.$emit("presentationPageRendering", page);
						this.scope.$emit("presentationPageRendered", page, this.maxPageNumber);
					}, this));
				}, this));
			};

			ODFCanvas.prototype.redrawPage = function() {
				sandboxApi.postMessage("redrawPage", {"redraw": true});
			};

			ODFCanvas.prototype.showPage = function(page) {
				if (page >= 1 && page <= this.maxPageNumber) {
					if (!this.doc) {
						this.pendingPageNumber = page;
					} else {
						this._showPage(page);
					}
				}
			};

			odfCanvas = new ODFCanvas($scope, container);

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
				sandboxApi.destroy();
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
			template: '<div class="canvasContainer odfcontainer"></div>',
			controller: controller
		};

	}];

});
