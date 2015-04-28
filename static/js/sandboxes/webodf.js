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

	var body = document.getElementsByTagName("body")[0];
	var script = document.getElementsByTagName("script")[0];
	var PARENT_ORIGIN = script.getAttribute("data-parent-origin");
	var WEBODF_URL = script.getAttribute("data-webodf-url");
	var container = document.getElementById("container");

	var webodfScript = null;
	var webodf = null;
	var runtime = null;

	var ODFCanvas_readFile = function(path, encoding, callback) {
		if (typeof path === "string") {
			runtime.orig_readFile.call(runtime, path, encoding, callback);
			return;
		}

		// we're loading typed arrays in the sandbox
		callback(null, new Uint8Array(path));
	};

	var ODFCanvas_loadXML = function(path, callback) {
		if (typeof path === "string") {
			runtime.orig_loadXML.call(runtime, path, callback);
			return;
		}

		// we're loading typed arrays in the sandbox
		var bb = new Blob([new Uint8Array(path)]);
		var f = new FileReader();
		f.onload = function(e) {
			var parser = new DOMParser();
			var doc = parser.parseFromString(e.target.result, "text/xml");
			callback(null, doc);
		};
		f.readAsText(bb);
	};

	var EmptyFakeStyle = function() {
	};

	EmptyFakeStyle.prototype.getPropertyValue = function(property) {
		return null;
	}

	var ODFCanvas_getWindow = function() {
		var result = runtime.orig_getWindow.apply(runtime, arguments);
		var orig_getComputedStyle = result.getComputedStyle

		// Firefox doesn't allow access to some styles, so return a
		// fake style for WebODF to use in that case.
		result.getComputedStyle = function() {
			var style = orig_getComputedStyle.apply(result, arguments);
			if (!style) {
				style = new EmptyFakeStyle();
			}
			return style;
		}

		return result;
	};

	var WebODFSandbox = function(window) {
		this.head = document.getElementsByTagName('head')[0];
		this.canvasDom = document.getElementById("odfcanvas");
		this.window = window;
		this.canvas = null;
		this.document_type = null;
	};

	WebODFSandbox.prototype.postMessage = function(type, message) {
		var msg = {"type": type};
		msg[type] = message;
		this.window.parent.postMessage(msg, PARENT_ORIGIN);
	};

	WebODFSandbox.prototype.openFile = function(source) {
		if (!webodfScript) {
			var that = this;
			webodfScript = document.createElement('script');
			webodfScript.type = "text/javascript";
			webodfScript.src = WEBODF_URL;
			webodfScript.onerror = function(evt) {
				that.postMessage("webodf.error", {"msgid": "loadScriptFailed"});
				that.head.removeChild(webodfScript);
				webodfScript = null;
			};
			webodfScript.onload = function(evt) {
				console.log("Using webodf.js " + that.window.webodf.Version);
				webodf = that.window.odf;

				// monkey-patch IO functions
				runtime = that.window.runtime;
				runtime.orig_readFile = runtime.readFile;
				runtime.readFile = ODFCanvas_readFile;
				runtime.orig_loadXML = runtime.loadXML;
				runtime.loadXML = ODFCanvas_loadXML;
				runtime.orig_getWindow = runtime.getWindow;
				runtime.getWindow = ODFCanvas_getWindow;

				that._doOpenFile(source);
			};
			this.head.appendChild(webodfScript);
		} else {
			this._doOpenFile(source);
		}
	};

	WebODFSandbox.prototype.closeFile = function() {
		if (this.canvas) {
			this.canvas.destroy(function() {
				// ignore callback
			});
			this.canvas = null;
		}
	};

	WebODFSandbox.prototype._doOpenFile = function(source) {
		this.postMessage("webodf.loading", {"source": source});
		if (!this.canvas) {
			var that = this;
			this.canvas = new webodf.OdfCanvas(this.canvasDom);
			this.canvas.addListener("statereadychange", function() {
				that._odfLoaded();
			});
		}

		this.canvas.setZoomLevel(1);
		this.canvas.load(source);
	};

	WebODFSandbox.prototype._odfLoaded = function() {
		var odfcontainer = this.canvas.odfContainer();
		console.log("ODF loaded", odfcontainer);
		this.document_type = odfcontainer.getDocumentType();
		var pages = [];
		switch (this.document_type) {
		case DOCUMENT_TYPE_PRESENTATION:
			container.className += " showonepage";
			pages = odfcontainer.rootElement.getElementsByTagNameNS(nsResolver('draw'), 'page');
			break;
		default:
			container.className = this.canvasDom.className.replace(/(?:^|\s)showonepage(?!\S)/g, "");
			break;
		}

		var numPages = Math.max(1, pages.length);
		this.postMessage("webodf.loaded", {"url": odfcontainer.getUrl(), "type": this.document_type, "numPages": numPages});
	};

	WebODFSandbox.prototype.showPage = function(page) {
		this.canvas.showPage(page);
		this.redrawPage();
	};

	WebODFSandbox.prototype.redrawPage = function() {
		if (this.canvas) {
			switch (this.document_type) {
			case DOCUMENT_TYPE_PRESENTATION:
				this.canvas.fitToContainingElement(container.offsetWidth, container.offsetHeight);
				break;

			default:
				this.canvas.fitToWidth(container.offsetWidth);
				break;
			}
		}
	};

	var sandbox = new WebODFSandbox(window);

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
		case "showPage":
			sandbox.showPage(data.page);
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
		sandbox.postMessage("webodf.keyUp", {"key": event.keyCode});
		event.preventDefault();
	});

	window.addEventListener("resize", function() {
		sandbox.redrawPage();
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

	console.log("WebODF sandbox ready.");
	sandbox.postMessage("ready", {"ready": true});

})();
