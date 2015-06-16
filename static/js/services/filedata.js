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
define(["jquery", "underscore", "sha", "webrtc.adapter"], function($, _, JsSHA) {

	var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem || null;
	if (!requestFileSystem) {
		console.warn("Browser support for filesystem API not found.");
	}

	// NOTE(longsleep): A single chunk is 60k - https://code.google.com/p/webrtc/issues/detail?id=2270
	// also Firefox does only support 16k maximum sents. See https://code.google.com/p/webrtc/issues/detail?id=2279.
	var fileChunkSize = window.webrtcDetectedBrowser === "chrome" ? 60000 : 16000;

	// Fake implementation for browsers which do not support FileSystem API.
	var FileWriterFake = function(owner) {
		this.owner = owner;
		this.file = null;
	};

	FileWriterFake.prototype.flush = function() {

		var l = this.owner.writeBuffer.length;
		this.owner.e.trigger("written", l, 0);
		if (this.owner.complete && !this.file) {
			// Sort.
			var writeBuffer = this.owner.writeBuffer.slice();
			writeBuffer.sort(function(a, b) {
				return a[0] - b[0];
			});
			// Strip sizes.
			var dataBuffer = writeBuffer.map(function(d) {
				// array contains [size, data]
				return d[1];
			});
			// Create.
			var data = new Blob(dataBuffer, {
				type: this.owner.info.type || "application/octet-stream"
			});
			var url = null;
			this.file = {
				toURL: function() {
					if (!url) {
						url = URL.createObjectURL(data);
					}
					return url;
				},
				remove: function(callback) {
					if (url) {
						URL.revokeObjectURL(url);
						url = null;
					}
					if (callback) {
						callback();
					}
				}
			}
			this.owner.file = this.file;
			this.owner.e.triggerHandler("complete", [this]);
		}

	};

	FileWriterFake.prototype.stop = function() {

		this.file = null;
		this.owner = null;

	};


	// FileSystem API writer.
	var FileWriterFileSystem = function(owner) {

		this.owner = owner;

		this.file = null;
		this.writing = false;
		this.written = 0;
		this.writing_written = 0;
		this.writer = null;

		this.create()

	};

	FileWriterFileSystem.prototype.supported = !! requestFileSystem;
	FileWriterFileSystem.prototype.filesystem = null;

	FileWriterFileSystem.prototype.create = function() {

		var generator = _.bind(function() {
			FileWriterFileSystem.prototype.filesystem.root.getFile(this.owner.id, {
				create: true,
				exclusive: true
			}, _.bind(function(fileEntry) {
				console.log("Generate file", this.owner, fileEntry);
				this.setup(fileEntry);
				this.flush();
			}, this), _.bind(function(e) {
				console.warn("Fileystem failed to create file.", e);
				this.owner.e.triggerHandler("failed", [e, this.owner]);
			}, this));
		}, this);
		if (!FileWriterFileSystem.prototype.filesystem) {
			this.requestFileSystem(null, _.bind(function(fs) {
				generator();
			}, this), _.bind(function(e) {
				this.owner.e.triggerHandler("error", [e, this.owner]);
			}, this));
		} else {
			generator();
		}

	};

	FileWriterFileSystem.prototype.requestFileSystem = function(size, cb, error) {

		if (!size) {
			// Default size.
			size = 5 * 1024 * 1024;
		}
		requestFileSystem(window.TEMPORARY, size, _.bind(function(fs) {
			// Success call.
			console.info("Opened file system.", fs.name)
			FileWriterFileSystem.prototype.filesystem = fs;
			if (cb) {
				cb(fs);
			}
		}, this), _.bind(function(e) {
			// Error call.
			console.warn("Failed to open file system.", e);
			if (error) {
				error(e);
			}
		}, this));

	};

	FileWriterFileSystem.prototype.setup = function(file) {
		this.file = file;
		this.file.createWriter(_.bind(function(fileWriter) {
			if (this.owner.stopped) {
				return;
			}
			//console.log("Writer created", fileWriter);
			fileWriter.onerror = _.bind(function(e) {
				console.warn("File write failed: " + e.toString());
				if (this.owner) {
					this.owner.e.triggerHandler("writeerror", [e, this]);
				}
			}, this);
			fileWriter.onwriteend = _.bind(function(e) {
				this.written += this.writing_written;
				this.writing_written = 0;
				this.writing = false;
				//console.log("Done file writing.", e, fileWriter.position, fileWriter.length);
				if (this.owner) {
					this.owner.e.trigger("written", this.written, this.owner.writeBuffer.length);
					this.flush();
				}
			}, this);
			//console.log("created writer for file", this.owner.info.size);
			this.writing = true;
			this.writer = fileWriter;
			this.written = 0;
			this.writing_written = 0;
			// Create fill with full size.
			fileWriter.truncate(this.owner.info.size || 0);
		}, this));
	};


	FileWriterFileSystem.prototype.flush = function() {

		if (this.writing || this.owner.stopped || !this.writer) {
			return;
		}

		var buffer = this.owner.writeBuffer;
		var length = buffer.length;

		if (length) {

			this.writing = true;
			//console.log("Flushing buffer to file writer", length);

			// Grab the current writeBuffer and empty it.
			var writeBuffer = buffer.splice(0, length);
			// Sort for bytes position.
			writeBuffer.sort(function(a, b) {
				return a[0] - b[0];
			});

			//console.log("In flush", writeBuffer.length);

			var next;
			var start = null;
			var pos;
			var d;
			var s;
			var tmp
			while (true) {

				// Grab next item.
				next = writeBuffer.shift();
				if (next) {
					s = next[0];
					d = next[1];
					if (start === null) {
						// Set write start bytes position and init write data.
						start = pos = s;
						tmp = [];
					}
				}

				if (pos !== s || !next) {

					// We have a gap or nothing more to write, seek and write the shit.
					//console.log("eyikes gap or finished", s, pos, next, this.writer.position, tmp.length);

					if (this.writer.position !== start) {
						//console.log("uhohu - seeking", this.writer.position, start);
						this.writer.seek(start);
					}

					// Write to file system.
					this.writing_written = tmp.length;
					this.writer.write(new Blob(tmp, {
						type: this.owner.info.type || "application/octet-stream"
					}));

					tmp = null;
					if (next) {
						// Add rest to buffer for a later flush.
						if (writeBuffer.length) {
							buffer.unshift.apply(buffer, writeBuffer);
						}
						buffer.unshift(next);
					}

					break;

				} else {

					// Add it to current write set.
					//console.log("coolio no gap", s, pos)
					tmp.push(d);
					pos += d.length;

				}

			}

		}

		if (this.owner.complete && !length) {
			this.owner.file = this.file;
			this.owner.e.triggerHandler("complete", [this]);
		}

	};

	FileWriterFileSystem.prototype.stop = function() {

		this.owner = null;
		this.writer = null;
		this.file = null;

	};

	// Create a reference to the supported writer.
	var FileWriter = FileWriterFileSystem.prototype.supported ? FileWriterFileSystem : FileWriterFake;

	// File wrapper.
	var File = function(id, file, info) {
		this.id = id;
		this.file = file;
		this.e = $({});
		this.scope = {}; // Additional data store.
		if (file) {
			this.info = {
				chunks: this.chunks = Math.ceil(file.size / fileChunkSize),
				size: file.size,
				name: file.name,
				type: file.type
			}
			this.complete = true;
		} else {
			this.info = info ? info : {};
			this.complete = false;
		}
		this.stopped = false;
		this.writer = null;
		this.writeBuffer = [];
	};

	File.prototype.getChunk = function(chunk_index, cb) {

		var start = fileChunkSize * chunk_index;
		// Avoid overseeks.
		var end = fileChunkSize * (chunk_index + 1);
		if (end > this.info.size) {
			end = this.info.size;
		}
		if (start >= end) {
			console.warn("Requested file chunk which is out of bound", chunk_index, start, end, this.info);
			return;
		}

		var reader = new FileReader();
		var blob = this.file.slice(start, end);
		reader.onload = function(event) {
			if (reader.readyState == FileReader.DONE) {
				cb(event.target.result);
			}
		};
		reader.readAsArrayBuffer(blob);

	};

	File.prototype.setChunk = function(chunk_index, byte_position, data) {

		if (this.stopped) {
			return;
		}

		this.writeBuffer.push([byte_position, data]);
		if (this.writer) {
			this.writer.flush();
		}

	};

	File.prototype.fileFinished = function() {

		if (!this.complete) {
			this.complete = true;
			this.flushToFilesystem();
		}

	};

	File.prototype.createWriter = function() {

		var writer = this.writer = new FileWriter(this);
		return writer;

	};

	File.prototype.flushToFilesystem = function(file) {
		if (this.stopped) {
			// Cannot do anything.
			return;
		}
		if (!this.writer) {
			this.createWriter(file);
		} else {
			this.writer.flush();
		}
	};

	File.prototype.toURL = function() {

		return this.file.toURL();

	};

	File.prototype.stop = function() {

		this.e.triggerHandler("stop", [this]);
		if (this.file && this.file.remove) {
			var file = this.file;
			this.file.remove(_.bind(function() {
				console.log("File removed", file);
			}, this));
			this.file = null;
		}
		if (this.writer) {
			this.writer.stop();
			this.writer = null;
		}
		this.writeBuffer = [];
		this.stopped = true;

	};

	// fileData
	return ["randomGen", function(randomGen) {

		// NOTE(longsleep): Check if its a good idea to create this new every time when needed.
		var randomSecret = randomGen.random();
		//console.log("Random secret", [randomSecret]);;

		var fileCount = 0;
		var filenamePrefix = randomGen.id();
		var filesTable = {};

		// public API.
		var fileData = {
			generateFile: function(id, info) {
				id = filenamePrefix + id;
				var file = filesTable[id] = new File(id, null, info);
				file.createWriter();
				return file;
			},
			createFile: function(namespace, data) {
				var id = namespace + "_" + (fileCount++);
				var shaObj = new JsSHA(id, "TEXT");
				var token = shaObj.getHMAC(randomSecret, "TEXT", "SHA-384", "HEX");
				var file = filesTable[token] = new File(token, data);
				return file;
			},
			purgeFile: function(id) {
				var file = filesTable[id];
				if (file) {
					file.stop();
					delete filesTable[id];
				}
			},
			getFile: function(id) {
				return filesTable[id];
			}
		}

		return fileData;

	}];

});
