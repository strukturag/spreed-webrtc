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
define(["mediastream/webrtc", "webrtc.adapter"], function() {

	// Simple array buffer join function, to create a third array buffer
	// NOTE(longsleep): This acutally copies the data in memory.
	var arrayBufferJoin = function(one, two) {
		var three = new Uint8Array(one.byteLength + two.byteLength);
		three.set(new Uint8Array(one), 0);
		three.set(new Uint8Array(two), one.byteLength);
		return three.buffer;
	}

	// Simple fast crc32 implementation for ArrayBuffers.
	var makeCRCTable = function() {
		var c;
		var crcTable = [];
		for (var n = 0; n < 256; n++) {
			c = n;
			for (var k = 0; k < 8; k++) {
				c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			crcTable[n] = c;
		}
		return crcTable;
	};
	var crcTable = makeCRCTable();
	var crc32 = function(view) {
		// Pass a Uint8Array.
		var crc = 0 ^ (-1);
		for (var i = 0; i < view.length; i++) {
			crc = (crc >>> 8) ^ crcTable[(crc ^ view[i]) & 0xFF];
		}
		return (crc ^ (-1)) >>> 0;
	};

	var FileChunkV0 = function(buffer, id, data) {
		// 1 byte version (0 as of now)
		// 3 byte reserved for further use
		// 4 byte chunk id
		// 4 byte crc32
		// rest is payload data
		this.version = 0;
		if (buffer) {
			this._open(buffer);
		} else if (typeof id !== "undefined" && data) {
			this._set(id, data);
		}
	};

	FileChunkV0.prototype._open = function(buffer, create) {
		this._v = new Uint8Array(buffer, 0, 1);
		// 3 bytes reserved here
		this._c = new Uint32Array(buffer, 4, 1);
		this._crc32 = new Uint32Array(buffer, 8, 1);
		this._buffer = buffer;
		this._data = new Uint8Array(this._buffer, 12, this._buffer.byteLength - 12);
		if (!create) {
			// Validate.
			if (this._v[0] !== this.version) {
				throw new TypeError("Data version mismatch.");
			}
			var c = crc32(this._data);
			//console.log("block", this._c[0], c, this._crc32[0]);
			if (this._crc32[0] !== c) {
				console.warn("Data crc32 error.", this._c[0], c, this._crc32[0]);
				throw new TypeError("Data crc32 error.", this._c[0], c, this._crc32[0]);
			}
		}
	};

	FileChunkV0.prototype._set = function(id, data) {
		var control = new ArrayBuffer(12);
		this._open(arrayBufferJoin(control, data), true);
		this._v[0] = this.version;
		this._c[0] = id;
		this._crc32[0] = crc32(new Uint8Array(data));
		//console.log("block", id, this._crc32[0], [this._buffer]);
	};

	FileChunkV0.prototype.data = function() {
		//console.log("data", [this._buffer, this._buffer.byteLength-12]);
		return this._data;
	};

	FileChunkV0.prototype.index = function() {
		return this._c[0];
	};

	FileChunkV0.prototype.raw = function() {
		return this._buffer;
	};

	FileChunkV0.prototype.size = function() {
		return this._data.length;
	};


	return ["$window", function($window) {

		// SCTP does not work properly in Chrome 31 when used with other Chrome versions.
		// Thus we require Chrome 32 for now. Firefox 28 can interop with Chrome 32 data channels - yay.
		var supported = ($window.webrtcDetectedBrowser === "chrome" && $window.webrtcDetectedVersion >= 32 && !$window.webrtcDetectedAndroid) || ($window.webrtcDetectedBrowser === "firefox" && $window.webrtcDetectedVersion >= 28 && !$window.webrtcDetectedAndroid);
		if (!supported) {
			console.warn("Browser support for binary file transfers not found.");
		}

		return {
			supported: supported,
			arrayBufferJoin: arrayBufferJoin,
			crc32: crc32,
			parseChunk: function(data, cb) {
				var version = new Uint8Array(data, 0, 1)[0];
				switch (version) {
					case 0:
						var filechunk = new FileChunkV0(data);
						if (cb) {
							cb(filechunk.index(), filechunk.data(), filechunk.size());
						}
						return filechunk;
					default:
						console.warn("Unknow data version.");
						break;
				}
			},
			makeChunk: function(idx, data) {
				return new FileChunkV0(null, idx, data);
			}
		}

	}];

});
