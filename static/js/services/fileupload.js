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
define(["jquery", "underscore", "webrtc.adapter"], function($, _) {

	// fileUpload
	return ["fileData", "fileTransfer", "safeApply", "alertify", "translation", function(fileData, fileTransfer, safeApply, alertify, translation) {

		var Session = function(token, scope) {

			this.token = token;
			this.scope = scope;

			this.running = true;

			this.connections = {};

			var cancel = scope.$on("cancelUpload", _.bind(function(event) {
				cancel();
				event.stopPropagation();
				this.running = false;
				_.each(this.connections, function(connection) {
					connection.cancel();
				});
				this.connections = {};
				this.scope = null;
			}, this));

		};

		Session.prototype.handleRequest = function(scope, xfer, data) {

			//console.log("handleRequest", [data], typeof data);

			if (typeof data === "string") {

				if (data.charCodeAt(0) === 2) {
					// Ignore whatever shit is sent us by Firefox.
					return;
				}
				// Control data request.
				var msg;
				try {
					msg = JSON.parse(data);
				} catch (e) {
					// Invalid JSON.
					console.warn("Invalid JSON received from file download request.", data);
					xfer.cancel();
					delete this.connections[xfer.id];
					return;
				}
				this.processRequest(scope, xfer, msg);

			} else {

				console.warn("Unkown data type received -> ignored", typeof data, [data]);
				xfer.cancel();
				delete this.connections[xfer];

			}

		};

		Session.prototype.processRequest = function(scope, xfer, msg) {

			if (!this.running) {
				xfer.cancel();
				return;
			}

			if (!this.connections.hasOwnProperty(xfer.id)) {
				console.log("New incoming download connection:", xfer);
				this.connections[xfer.id] = xfer;
				xfer.e.on("closed", _.bind(function() {
					console.log("Incoming download connection closed:", xfer);
					delete this.connections[xfer.id];
				}, this));
			}

			var info = this.scope.info;

			switch (msg.m) {
				case "r":
					// Request chunk.
					//console.debug("Request a chunk", msg, xfer.id);
					var chunk = parseInt(msg.i || 0, 10);
					var file = fileData.getFile(info.id);
					file.getChunk(chunk, _.bind(function(data) {
						//console.log("Sending chunk", chunk, data.byteLength);
						if (!this.running) {
							return;
						}
						var filechunk = fileTransfer.makeChunk(chunk, data);
						xfer.send(filechunk.raw());
						safeApply(this.scope, function($scope) {
							$scope.$emit("uploadedChunk", chunk, data.byteLength);
						});
					}, this));
					break;
				case "bye":
					// Close this xfer.
					xfer.cancel();
					break;
				default:
					console.log("Unknown xfer control request", msg.m, msg);
					break;
			}

		};


		var FileUpload = function() {
			this.supported = fileTransfer.supported;
		};

		FileUpload.prototype.bindClick = function(namespace, element, cb) {

			// Helper to allow later modifications.
			var binder = {
				namespace: function() {
					return namespace;
				}
			}

			$(element).on("click", _.bind(function(event) {

				event.preventDefault();

				if (!this.supported) {
					alertify.dialog.alert(translation._("Your browser does not support file transfer."));
					return;
				}

				// Create new input.
				var input = $('<input type="file" multiple>');
				input.css({
					visibility: "hidden",
					position: "absolute",
					left: "0px",
					top: "0px",
					height: "0px",
					width: "0px"
				});
				input.change(function(ev) {
					var dataTransfer = ev.target;
					var files = [];
					var i;
					for (i = 0; i < dataTransfer.files.length; i++) {
						files.push(fileData.createFile(binder.namespace(), dataTransfer.files[i]));
					}
					//console.log("click event", dataTransfer, files, files.length);
					if (cb) {
						cb(files);
					}
				});
				input.click();

			}, this));

			// Return helper.
			return binder;

		};

		FileUpload.prototype.bindDrop = function(namespace, element, cb) {
			//console.log("Binding file upload drop to", namespace, element);

			// Helper to allow later modifications.
			var binder = {
				namespace: function() {
					return namespace;
				}
			}

			$(element).on("dragover dragenter", function(event) {
				event.preventDefault();
			});
			$(element).on("drop", _.bind(function(event) {

				event.preventDefault();

				if (!this.supported) {
					alertify.dialog.alert(translation._("Your browser does not support file transfer."));
					return;
				}

				var dataTransfer = event.originalEvent.dataTransfer;
				var files = [];
				var i;
				for (i = 0; i < dataTransfer.files.length; i++) {
					files.push(fileData.createFile(binder.namespace(), dataTransfer.files[i]));
				}
				//console.log("drop event", dataTransfer, files, files.length);
				if (cb) {
					cb(files);
				}

			}, this));

			// Return helper.
			return binder;

		};

		FileUpload.prototype.createSession = function(scope, token) {

			var session = new Session(token, scope);
			//console.log("Created new file download session", id, session);
			return session;
		};

		FileUpload.prototype.startUpload = function(scope, token) {

			var session = this.createSession(scope, token);
			return session;

		};


		// Create singleton.
		var fileUpload = new FileUpload();

		return fileUpload;

	}];

});
