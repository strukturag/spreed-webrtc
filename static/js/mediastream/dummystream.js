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
define([], function() {

	// Dummy stream implementation.
	var DummyStream = function(id) {
		this.id = id ? id : "defaultDummyStream";
	};
	DummyStream.prototype.stop = function() {};
	DummyStream.prototype.getAudioTracks = function() { return [] };
	DummyStream.prototype.getVideoTracks = function() { return [] };
	DummyStream.not = function(stream) {
		// Helper to test if stream is a dummy.
		return !stream || stream.stop !== DummyStream.prototype.stop;
	};
	DummyStream.is = function(stream) {
		return stream && stream.stop === DummyStream.prototype.stop;
	};

	return DummyStream;

});