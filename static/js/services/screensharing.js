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
define(['webrtc.adapter'], function() {

	// screensharing
	return ["$window", function($window) {

		// Check if we can do screensharing.
		var supported = false;
		if ($window.webrtcDetectedBrowser === "chrome") {
			if ($window.webrtcDetectedVersion >= 32 &&
				$window.webrtcDetectedVersion < 37) {
				// Support for flag based developer screen sharing came in Chrome 32.
				// It was removed in Chrome 37 in favour of chrome.chooseDesktopMedia
				// https://code.google.com/p/chromium/issues/detail?id=347641
				supported = true;
			} else if ($window.webrtcDetectedVersion >= 37) {
				// We need a extension to support screen sharing. See
				// https://developer.chrome.com/extensions/desktopCapture#method-chooseDesktopMedia
				// for details.
			}
		} else {
			// Currently Chrome only.
		}

		// public API.
		return {
			supported: supported
		}

	}];

});