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
define(["underscore", "jquery", "webrtc.adapter"], function(_, $) {

	// firefoxExtension
	return ["$window", "$q", "alertify", "translation", function($window, $q, alertify, translation) {

		var FirefoxExtension = function() {
			this.available = false;
			this.e = $({});
			this.autoinstall = {};
			this.initialize();
		};

		FirefoxExtension.prototype.initialize = function() {
			var marker = $window.document.getElementById("firefoxextension-available");
			console.log('Firefox extension marker', marker);
			if (marker) {
				this.available = true;
				console.log("Firefox extension is available.");
				this.e.triggerHandler("available", true);
			} else if (!marker && this.available) {
				this.available = false;
				console.log("Firefox extension is no longer available.");
				this.e.triggerHandler("available", false);
			}
		};

		FirefoxExtension.prototype.registerAutoInstall = function(installFunc, cancelInstallFunc, force) {

			this.autoinstall.install = installFunc;
			this.autoinstall.cancel = cancelInstallFunc;
			this.autoinstall.force = !!force;
			if (!this.available && installFunc) {
				this.e.triggerHandler("available", true);
			}

		};

		// Create extension api and wait for messages.
		var extension = new FirefoxExtension();

		// Always register default auto install which tells user that extension is required
		// if screen sharing can only work with extension.
		if ($window.webrtcDetectedBrowser === "firefox" && $window.webrtcDetectedVersion >= 36) {
			extension.registerAutoInstall(function() {
				var d = $q.defer();
				alertify.dialog.alert(translation._("Screen sharing requires a browser extension. Please add the Spreed WebRTC screen sharing extension to Firefox and try again."));
				d.reject("Manual extension installation required");
				return d.promise;
			});
		}

		// Expose.
		return extension;

	}];

});
