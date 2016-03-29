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
(function () {

	var script = document.getElementsByTagName("script")[0];
	var PARENT_ORIGIN = script.getAttribute("data-parent-origin");
	var PDFJS_URL = script.getAttribute("data-pdfjs-url");
	var PDFJS_WORKER_URL = script.getAttribute("data-pdfjs-worker-url");
	var PDFJS_COMPATIBILITY_URL = script.getAttribute("data-pdfjs-compatibility-url");
	var container = document.getElementById("container");

	var pdfScript = null;
	var pdfjs = null;

	var PdfJsSandbox = function(window) {
		this.head = document.getElementsByTagName('head')[0];
		this.canvases = document.getElementsByTagName('canvas');
		this.window = window;
		this.doc = null;
		this.currentPage = null;
		this.canvasIndex = 0;
		this.renderTask = null;
	};

	PdfJsSandbox.prototype.postMessage = function(type, message) {
		var msg = {"type": type};
		msg[type] = message;
		this.window.parent.postMessage(msg, PARENT_ORIGIN);
	};

	PdfJsSandbox.prototype.openFile = function(source) {
		if (!pdfScript) {
			var that = this;
			var compat = document.createElement('script');
			compat.type = "text/javascript";
			compat.src = PDFJS_COMPATIBILITY_URL;
			this.head.appendChild(compat);

			pdfScript = document.createElement('script');
			pdfScript.type = "text/javascript";
			pdfScript.src = PDFJS_URL;
			pdfScript.onerror = function(evt) {
				that.postMessage("pdfjs.error", {"msgid": "loadScriptFailed"});
				that.head.removeChild(pdfScript);
				pdfScript = null;
			};
			pdfScript.onload = function(evt) {
				pdfjs = that.window.PDFJS;
				if (PDFJS_WORKER_URL) {
					pdfjs.workerSrc = PDFJS_WORKER_URL;
				}
				if (true) {
					// We currently cannot use a web worker in a sandboxed iFrame
					// and in addition to that Firefox 45+ fail with an uncatchable
					// exception (see https://bugzilla.mozilla.org/show_bug.cgi?id=1260388)
					// So we always disable the worker for now, making PDF.js running
					// in fake worker mode.
					pdfjs.disableWorker = true;
				}
				console.log("Using pdf.js " + pdfjs.version + " (build " + pdfjs.build + ")");
				that._doOpenFile(source);
			};
			this.head.appendChild(pdfScript);
		} else {
			this._doOpenFile(source);
		}
	};

	PdfJsSandbox.prototype.closeFile = function() {
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
		// clear visible canvas so it's empty when we show the next document
		var canvas = this.canvases[this.canvasIndex];
		canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
	};

	PdfJsSandbox.prototype._doOpenFile = function(source) {
		var that = this;
		this.postMessage("pdfjs.loading", {"source": source});
		pdfjs.getDocument(source).then(function(doc) {
			that._pdfLoaded(source, doc);
		}, function(error, exception) {
			that._pdfLoadError(source, error, exception);
		});
	};

	PdfJsSandbox.prototype._pdfLoaded = function(source, doc) {
		console.log("PDF loaded", doc);
		this.doc = doc;
		this.postMessage("pdfjs.loaded", {"source": source, "doc": {"numPages": doc.numPages}});
	};

	PdfJsSandbox.prototype._pdfLoadError = function(source, error, exception) {
		this.postMessage("pdfjs.loadError", {"source": source, "error": error});
	};

	PdfJsSandbox.prototype.loadPage = function(page) {
		if (this.currentPage) {
			this.currentPage.destroy();
			this.currentPage = null;
		}
		var that = this;
		this.doc.getPage(page).then(function(pageObject) {
			that._pageLoaded(page, pageObject);
		}, function(error, exception) {
			that._pageLoadError(page, error, exception);
		});
	};

	PdfJsSandbox.prototype._pageLoaded = function(page, pageObject) {
		console.log("Got page", pageObject);
		this.currentPage = pageObject;
		this.postMessage("pdfjs.pageLoaded", {"page": page});
		this.drawPage(pageObject);
	};

	PdfJsSandbox.prototype._pageLoadError = function(page, error, exception) {
		console.error("Could not load page", page, error, exception);
		this.postMessage("pdfjs.pageLoadError", {"page": page, "error": error});
	};

	PdfJsSandbox.prototype._stopRendering = function() {
		if (this.renderTask) {
			if (this.renderTask.internalRenderTask && this.renderTask.internalRenderTask.cancel) {
				this.renderTask.internalRenderTask.cancel();
			}
			this.renderTask = null;
		}
	}

	PdfJsSandbox.prototype.drawPage = function(pageObject) {
		var pdfView = pageObject.view;
		var pdfWidth = pdfView[2] - pdfView[0];
		var pdfHeight = pdfView[3] - pdfView[1];
		var w = container.offsetWidth;
		var h = container.offsetHeight;
		var scale = w / pdfWidth;
		if (pdfHeight * scale > h) {
			scale = container.offsetHeight / pdfHeight;
		}

		// use double-buffering to avoid flickering while
		// the new page is rendered...
		var canvas = this.canvases[1 - this.canvasIndex];
		var viewport = pageObject.getViewport(scale);
		canvas.width = Math.round(viewport.width);
		canvas.height = Math.round(viewport.height);
		var renderContext = {
			canvasContext: canvas.getContext("2d"),
			viewport: viewport
		};

		console.log("Rendering page", pageObject);
		this.postMessage("pdfjs.renderingPage", {"page": pageObject.pageNumber});

		// TODO(fancycode): also render images in different resolutions for subscribed peers and send to them when ready
		this._stopRendering();
		var renderTask = pageObject.render(renderContext);
		this.renderTask = renderTask;
		var that = this;
		renderTask.promise.then(function() {
			that._pageRendered(pageObject);
		}, function(error, exception) {
			that._pageRenderError(pageObject, error, exception);
		});
	};

	PdfJsSandbox.prototype._pageRendered = function(pageObject) {
		this.renderTask = null;
		console.log("Rendered page", pageObject.pageNumber);
		this.postMessage("pdfjs.pageRendered", {"page": pageObject.pageNumber});
		// ...and flip the buffers...
		this.canvases[this.canvasIndex].style.display = "none";
		this.canvasIndex = 1 - this.canvasIndex;
		this.canvases[this.canvasIndex].style.display = "block";
	};

	PdfJsSandbox.prototype._pageRenderError = function(pageObject, error, exception) {
		if (error === "cancelled") {
			return;
		}
		console.error("Could not render page", pageObject, error, exception);
		this.renderTask = null;
		this.postMessage("pdfjs.pageRenderError", {"page": pageObject.pageNumber, "error": error});
	};

	PdfJsSandbox.prototype.redrawPage = function() {
		if (this.currentPage !== null) {
			this.drawPage(this.currentPage);
		}
	};

	var sandbox = new PdfJsSandbox(window);

	window.addEventListener("message", function(event) {
		if (event.origin !== PARENT_ORIGIN) {
			// only accept messages from spreed-webrtc
			return;
		}
		var msg = event.data;
		var data = msg[msg.type] || {};
		switch (msg.type) {
		case "openFile":
			sandbox.openFile(data.source);
			break;
		case "closeFile":
			sandbox.closeFile();
			break;
		case "loadPage":
			sandbox.loadPage(data.page);
			break;
		case "redrawPage":
			sandbox.redrawPage();
			break;
		default:
			console.log("Unknown message received", event);
			break;
		}
	}, false);

	document.addEventListener("keyup", function(event) {
		sandbox.postMessage("pdfjs.keyUp", {"key": event.keyCode});
		event.preventDefault();
	});

	var toggleFullscreen = function(elem) {
		var fullScreenElement = document.fullscreenElement || document.msFullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement;
		if (fullScreenElement) {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			}
		} else {
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			} else if (elem.webkitRequestFullscreen) {
				elem.webkitRequestFullscreen();
			} else if (elem.mozRequestFullScreen) {
				elem.mozRequestFullScreen();
			} else if (elem.msRequestFullscreen) {
				elem.msRequestFullscreen();
			}
		}
	};

	container.addEventListener("dblclick", function(event) {
		toggleFullscreen(container);
	});

	console.log("pdf.js sandbox ready.");
	sandbox.postMessage("ready", {"ready": true});

})();
