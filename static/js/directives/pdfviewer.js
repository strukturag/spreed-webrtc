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
define(['require', 'jquery', 'underscore', 'text!partials/pdfviewer.html', 'pdf'], function(require, $, _, template, pdf) {

	pdf.workerSrc = require.toUrl('pdf.worker') + ".js";

	return ["$window", "fileUpload", "alertify", "translation", function($window, fileUpload, alertify, translation) {

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			var pane = $element.find(".pdfviewerpane");
			var canvases = $element.find(".pdfviewercanvas");
			$scope.canvasIndex = 0;

			$scope.layout.pdfviewer = false;
			$scope.hideControlsBar = false;

			$scope.doc = null;
			$scope.rendering = false;
			$scope.scale = 0.8;
			$scope.currentPage = null;
			$scope.currentPageNumber = -1;
			$scope.maxPageNumber = -1;
			$scope.pendingPageNumber = null;

			var namespace = "file_" + $scope.id;
			var binder = fileUpload.bindDrop(namespace, $element, _.bind(function(files) {
				console.log("File dragged", files);
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
					// TODO(fancycode): notify other peers about PDF, they should either request the file or subscribe rendered images (e.g. for mobile app)
				}, this));
			}, this));
			binder.namespace = function() {
				// Inject own id into namespace.
				return namespace + "_" + $scope.myid;
			};

			$scope.showPage = function(page) {
				console.log("Showing page", page, "/", $scope.maxPageNumber);
				if ($scope.currentPage) {
					$scope.currentPage.destroy();
					$scope.currentPage = null;
				}
				$scope.rendering = true;
				$scope.currentPageNumber = page;
				$scope.doc.getPage(page).then(function(page) {
					console.log("Got page", page);
					$scope.currentPage = page;
					var viewport = page.getViewport($scope.scale);
					// use double-buffering to avoid flickering while
					// the new page is rendered...
					var canvas = canvases[1 - $scope.canvasIndex];
					canvas.width = viewport.width;
					canvas.height = viewport.height;
					var renderContext = {
						canvasContext: canvas.getContext("2d"),
						viewport: viewport
					};

					console.log("Rendering page", page);
					// TODO(fancycode): also render images in different resolutions for subscribed peers and send to them when ready
					var renderTask = page.render(renderContext);
					renderTask.promise.then(function() {
						$scope.$apply(function(scope) {
							console.log("Rendered page", page);
							scope.rendering = false;
							// ...and flip the buffers...
							scope.canvasIndex = 1 - scope.canvasIndex;
							console.log("Done");
							if (scope.pendingPageNumber !== null) {
								scope.showPage(scope.pendingPageNumber);
								scope.pendingPageNumber = null;
							}
						});
					});
				});
			};

			$scope.queuePageRendering = function(page) {
				if ($scope.rendering) {
					$scope.pendingPageNumber = page;
				} else {
					$scope.showPage(page);
				}
			};

			$scope.prevPage = function() {
				if ($scope.currentPageNumber > 1) {
					$scope.queuePageRendering($scope.currentPageNumber - 1);
				}
			};

			$scope.nextPage = function() {
				if ($scope.currentPageNumber < $scope.maxPageNumber) {
					$scope.queuePageRendering($scope.currentPageNumber + 1);
				}
			};

			$scope.showPDFViewer = function() {
				console.log("PDF viewer active");
				if ($scope.layout.pdfviewer) {
					$scope.hidePDFViewer();
				}

				var url = "http://cdn.mozilla.net/pdfjs/tracemonkey.pdf";
				console.log("Loading PDF from", url);
				pdf.getDocument(url).then(function(doc) {
					$scope.$apply(function(scope) {
						scope.doc = doc;
						scope.maxPageNumber = doc.numPages;
						console.log("PDF loaded", doc);
						scope.queuePageRendering(1);
					});
				});

				$scope.layout.pdfviewer = true;
				$scope.$emit("mainview", "pdfviewer", true);
			};

			$scope.hidePDFViewer = function() {
				console.log("PDF viewer disabled");
				if ($scope.doc) {
					$scope.doc.cleanup();
					$scope.doc.destroy();
					$scope.doc = null;
				}
				// clear visible canvas so it's empty when we show the next document
				var canvas = canvases[$scope.canvasIndex];
				canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
				$scope.layout.pdfviewer = false;
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
