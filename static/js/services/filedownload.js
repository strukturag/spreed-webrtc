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
define(["jquery", "underscore"], function($, _) {

	return ["fileData", "fileTransfer", "$window", "mediaStream", "safeApply", "$timeout", function(fileData, fileTransfer, $window, mediaStream, safeApply, $timeout) {

		var downloads = 0;

		var Session = function(fileDownload, id, token, scope) {

			this.fileDownload = fileDownload;
			this.id = id;
			this.token = token;
			this.scope = scope;
			this.file = null;

			this.interval = null;
			this.running = false;

			this.known_peer_id = null;

			this.chunk = 0;
			this.end = scope.info.chunks - 1;
			this.fragments = 100;
			this.concurrent = 5;
			this.downloadedBytes = 0;
			this.totalBytes = scope.info.size;

			this.jobs = [];
			this.xfer_all = [];
			this.xfer_connected = [];

		};

		Session.makeId = function(token, idx) {
			return [token, idx].join("_");
		};

		Session.prototype.cancel = function() {

			this.running = false;
			$window.clearInterval(this.interval);
			this.interval = null;

			// Close all known xfers.
			_.each(this.xfer_all, function(xfer) {
				// Implement own clean up message.
				// NOTE(longsleep): See https://code.google.com/p/webrtc/issues/detail?id=1676 for reason.
				xfer.send({
					m: "bye"
				});
				$timeout(function() {
					xfer.cancel();
				}, 0);
			});
			_.each(this.jobs, function(job) {
				job.stop = true;
			});
			this.xfer_all = [];
			this.xfer_connected = [];
			this.jobs = [];
			this.file = null;

		};

		Session.prototype.run = function(id) {

			this.known_peer_id = id;
			this.running = true;

			// Make file.
			var file = this.file = fileData.generateFile("" + (downloads++) + ".file", this.scope.info);
			// Bind file events.
			file.e.bind("complete", _.bind(function() {
				safeApply(this.scope, function($scope) {
					var url = file.toURL();
					console.log("Generated URL", url);
					$scope.$emit("writeComplete", url, file);
				});
			}, this));
			file.e.bind("error writerror failed", _.bind(function(event, e) {
				console.log("Error occured.", event, e);
				this.cancel();
				safeApply(this.scope, function($scope) {
					$scope.error = true;
				});
			}, this));
			file.e.bind("written", _.bind(function(event, written, queue) {
				safeApply(this.scope, _.bind(function($scope) {
					$scope.$emit("downloadedWritten", written, queue);
				}, this));
			}, this));

			// Bind events.
			var scope = this.scope;
			var cancel = scope.$on("cancelDownload", _.bind(function(event) {
				event.stopPropagation();
				cancel(); // event self unregister.
				fileData.purgeFile(file.id);
				this.cancel()
			}, this));

			// Create download plan.
			this.addXfer(id, _.bind(function() {
				this.process();
			}, this));

			// Start download interval.
			this.interval = $window.setInterval(_.bind(function() {
				//console.log("download session running", this.xfer_all.length, this.concurrent, this.chunk, this.scope.info.chunks, this.scope.info.chunks / this.fragments);
				this.process();
				if (this.running && this.xfer_all.length < this.concurrent && this.chunk <= this.end && (this.end + 1) / this.fragments >= this.xfer_all.length - 2) {
					// Start more if file is large enough (about 10 MB).
					this.addXfer(this.known_peer_id);
				}
			}, this), 1000);

		};

		Session.prototype.process = function() {

			if (!this.running) {
				return;
			}

			if (!this.xfer_all.length && this.known_peer_id !== null) {
				this.addXfer(this.known_peer_id);
				return;
			}

			if (this.chunk > this.end) {
				// No more jobs to give.
				return;
			}

			var xfer = this.xfer_connected.shift();
			if (xfer) {
				var session = this;
				var job = {};
				this.jobs.push(job);
				job.chunk = this.chunk;
				job.end = job.chunk + this.fragments;
				if (job.end > this.end) {
					job.end = this.end;
				}
				this.chunk = job.end + 1;
				job.next = _.bind(function() {
					if (this.stop) {
						this.next = null;
						return;
					}
					if (this.chunk > this.end) {
						xfer.e.off("sessionData");
						session.xfer_connected.push(xfer);
						this.next = null;
						session.done(this);
						return;
					}
					session.fileDownload.sendRequest(xfer, this.chunk++);
				}, job);
				//console.log("Starting new job", job, this.fragments, xfer.id);
				xfer.e.on("sessionData", _.bind(this.handleData, this, job));
				job.next();
			}

		};

		Session.prototype.done = function(job) {

			console.log("Job done", job, this.end, this.chunk);
			var idx = this.jobs.indexOf(job);
			if (~idx) { // Yay i love fancy code which is hard to understand!
				this.jobs.splice(idx, 1);
			}
			if (this.chunk >= this.end && this.jobs.length === 0) {
				//console.log("File done.")
				safeApply(this.scope, _.bind(function($scope) {
					$scope.$emit("downloadComplete");
				}, this));
				this.file.fileFinished();
				this.cancel();
			}

		};

		Session.prototype.handleData = function(job, event, data) {

			//console.log("session handleData", this, job, data);

			// Parse data.
			fileTransfer.parseChunk(data, _.bind(function(idx, data, size) {
				var file = this.file;
				if (!file.scope.chunk_size) {
					file.scope.chunk_size = size;
					//console.log("Chunk payload size", size);
				}
				var byte_position = file.scope.chunk_size * idx;
				file.setChunk(idx, byte_position, data);
				safeApply(this.scope, _.bind(function($scope) {
					this.downloadedBytes += data.byteLength;
					$scope.$emit("downloadedChunk", idx, data.byteLength, this.downloadedBytes, this.totalBytes);
					job.next();
				}, this));
			}, this));

		};

		Session.prototype.rmXfer = function(xfer) {

			var idx = this.xfer_connected.indexOf(xfer);
			if (~idx) {
				this.xfer_connected.splice(idx, 1);
			}
			idx = this.xfer_all.indexOf(xfer);
			if (~idx) {
				this.xfer_all.splice(idx, 1);
			}
			//console.log("Xfer removed");

		};

		Session.prototype.addXfer = function(to, connected_cb) {

			//console.log("Adding new xfer", to);
			mediaStream.webrtc.doXfer(to, this.token, {
				created: _.bind(function(xfer) {
					//console.log("Xfer created", xfer);
					this.xfer_all.push(xfer);
				}, this),
				connected: _.bind(function(xfer) {
					//console.log("Xfer connected", xfer);
					this.xfer_connected.push(xfer);
					if (connected_cb) {
						connected_cb(xfer);
					}
				}, this),
				error: _.bind(function(xfer) {
					//console.log("Xfer error", xfer);
					this.rmXfer(xfer);
				}, this),
				closed: _.bind(function(xfer) {
					//console.log("Xfer closed.", xfer);
					this.rmXfer(xfer);
				}, this)
			});

		};


		var FileDownload = function() {
			this.supported = fileTransfer.supported;
			this.downloads = 0;
			this.sessions = {};
		};

		FileDownload.prototype.sendRequest = function(xfer, chunk) {

			var data = {
				m: "r",
				i: chunk
			}

			//console.log("sendRequest", data, xfer.id);
			xfer.send(data);

		};

		FileDownload.prototype.createSession = function(scope, token) {

			var id = Session.makeId(token, this.downloads++);
			var session = this.sessions[id] = new Session(this, id, token, scope);
			//console.log("Created new file download session", id, session);
			return session;
		};

		FileDownload.prototype.getSession = function(token, idx) {

			var id = Session.makeId(token, idx);
			var session = this.sessions[id];
			if (!session) {
				console.warn("Get unknown file download session", id);
				return null;
			}
			return session;

		};

		FileDownload.prototype.startDownload = function(scope, owner_id, token) {

			var session = this.createSession(scope, token);
			session.run(owner_id);
			return session;

		};

		FileDownload.prototype.handleRequest = function(scope, xfer, data) {

			//console.log("handleRequest", [data], typeof data);

			if (data instanceof ArrayBuffer) {

				// Data
				//console.log("Received data package", xfer.id, data.byteLength, scope);
				xfer.e.triggerHandler("sessionData", [data]);

			} else {

				console.warn("Unkown data type received -> ignored", typeof data, [data]);

			}

		};

		return new FileDownload();

	}];

});
