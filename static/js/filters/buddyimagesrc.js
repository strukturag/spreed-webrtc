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
define(["underscore"], function(_) {

	// Simple function which converts data urls to blobs, both base64 or not.
	var dataURLToBlob = (function() {
		var is_base64 = ";base64,";
		return function(dataURL) {
			var parts, ct;
			if (dataURL.indexOf(is_base64) === -1) {
				// No base64.
				parts = dataURL.split(",");
				ct = parts[0].split(":")[1];
				return new Blob([parts[1]], {
					type: ct
				});
			}
			parts = dataURL.split(is_base64);
			ct = parts[0].split(":")[1];
			var data = window.atob(parts[1]);
			var length = data.length;
			var buffer = new Uint8Array(length);
			for (var i = 0; i < length; i++) {
				buffer[i] = data.charCodeAt(i);
			}
			return new Blob([buffer], {
				type: ct
			});
		};
	}());

	// Create URLs for blobs.
	var blobToObjectURL = function(blob) {
		return URL.createObjectURL(blob);
	};

	var revokeBlobURL = function(url) {
		return URL.revokeObjectURL(url);
	};

	// buddyImageSrc
	return ["buddyData", "appData", function(buddyData, appData) {

		// Cache created blob urls.
		var urls = {};
		var revokeURL = function(id, url) {
			delete urls[id];
			revokeBlobURL(url);
		};

		// Cleanup helper.
		window.setInterval(function() {
			_.each(urls, function(url, id) {
				if (!buddyData.get(id)) {
					revokeURL(id, url);
				}
			});
		}, 5000);

		return function(id) {

			var scope = buddyData.lookup(id, false, true);
			if (scope) {
				var display = scope.display;
				if (display) {
					if (display.buddyPictureLocalUrl) {
						return display.buddyPictureLocalUrl;
					} else if (display.buddyPicture) {
						var url = urls[id];
						if (url) {
							revokeURL(id, url);
						}
						// New data -> new url.
						var blob = dataURLToBlob(display.buddyPicture);
						url = display.buddyPictureLocalUrl = urls[id] = blobToObjectURL(blob);
						return url;
					}
				}
			} else {
				var data = appData.get();
				if (data) {
					if (id === data.id) {
						if (data.master.buddyPicture) {
							return data.master.buddyPicture;
						}
					}
				}
			}
			return "";
		};

	}];

});
