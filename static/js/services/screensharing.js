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
define(['underscore', 'webrtc.adapter'], function(_) {

	// screensharing
	return ["$window", "$q", "chromeExtension", function($window, $q, chromeExtension) {

		// Check if we can do screensharing.
		var supported = false;

		// Define our helpers.
		var prepare = null;
		var cancel = null;

		// Chrome support.
		if ($window.webrtcDetectedBrowser === "chrome") {
			if ($window.webrtcDetectedVersion >= 32 &&
				$window.webrtcDetectedVersion < 37) {
				// Support for flag based developer screen sharing came in Chrome 32.
				// It was removed in Chrome 37 in favour of chrome.chooseDesktopMedia
				// https://code.google.com/p/chromium/issues/detail?id=347641
				supported = true;
				prepare = function(options) {
					// This generates constrains for the flag based screen screensharing
					// support in Chrome 31+ to 36. Flag to be enabled is found at:
					// chrome://flags/#enable-usermedia-screen-capture
					var d = $q.defer()
					var opts = _.extend({
						chromeMediaSource: "screen"
					}, options);
					d.resolve(opts);
					return d.promise;
				};
			} else if ($window.webrtcDetectedVersion >= 37) {
				// We need a extension to support screen sharing. See
				// https://developer.chrome.com/extensions/desktopCapture#method-chooseDesktopMedia
				// for details.
			}

			if (chromeExtension.available) {
				supported = true;
				var pending = null;
				prepare = function(options) {
					var select = chromeExtension.call({
						Type: "Action",
						Action: "chooseDesktopMedia"
					});
					var d = $q.defer();
					select.then(function(id) {
						// Success with id.
						pending = null;
						if (id) {
							var opts = _.extend({
								chromeMediaSource: "desktop",
								chromeMediaSourceId: id
							}, options);
							d.resolve(opts);
						} else {
							d.resolve(null);
						}
					}, function(err) {
						// Error.
						pending = null;
						console.log("Failed to prepare screensharing", err);
						d.reject(err);
					}, function(data) {
						// Notify.
						pending = data;
					});
					return d.promise;
				};
				cancel = function() {
					if (pending !== null) {
						chromeExtension.call({
							Type: "Action",
							Action: "cancelChooseDesktopMedia",
							Args: pending
						});
						pending = null;
					}
				};
			}

		} else {
			// Currently Chrome only - sorry.
			// Firefox 33 might get screen sharing support.
			// See https://bugzilla.mozilla.org/show_bug.cgi?id=923225
		}

		// public API.
		return {
			supported: supported,
			getScreen: function(options) {
				if (prepare) {
					return prepare(options);
				} else {
					var d = $q.defer()
					d.reject("No implementation to get screen.");
					return d.promise;
				}
			},
			cancelGetScreen: function() {
				if (cancel) {
					cancel();
				}
			}
		}

	}];

});