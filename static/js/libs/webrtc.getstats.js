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

var getRTCStats = null;

define(['webrtc.adapter'], function() {

	switch (webrtcDetectedBrowser) {
	case "firefox":
		getRTCStats = function(peerconnection, callback) {
			peerconnection.getStats(
				null,
				function (res) {
					var items = [];
					res.forEach(function(result) {
						items.push(result);
					});
					callback(items);
				},
				callback
			);
		};
		break;

	case "chrome":
		getRTCStats = function(peerconnection, callback) {
			peerconnection.getStats(function(res) {
				var items = [];
				res.result().forEach(function(result) {
					var item = {};
					result.names().forEach(function(name) {
						item[name] = result.stat(name);
					});
					item.id = result.id;
					item.type = result.type;
					item.timestamp = result.timestamp;
					items.push(item);
				});
				callback(items);
			});
		};
		break;

	default:
		// browser doesn't support WebRTC
		break;
	}

});
