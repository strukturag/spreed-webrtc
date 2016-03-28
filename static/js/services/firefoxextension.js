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
	return ["$window", "$q", "alertify", "translation", "$interval", function($window, $q, alertify, translation, $interval) {

		var EXTENSION_DOM_ID = 'firefoxextension-available';

		var intervalSecs = 50;
		var intervalCount = 1;
		var isAvailable = function() {
			return $window.document.getElementById(EXTENSION_DOM_ID);
		};

		var FirefoxExtension = function() {
			this.available = false;
			this.e = $({});
			this.autoinstall = {};
			this.initialize();
		};

		FirefoxExtension.prototype.initialize = function() {
			if (isAvailable()) {
				this.available = true;
				console.log("Firefox extension is available.");
				this.e.triggerHandler("available", true);
			} else if (this.available) {
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

		/**
		 * Checks for availability of the Firefox extension by looking for the id which the extension
		 * will append to the body of the document. Unfortunately there is no callback
		 * API implemented by Firefox which will allow other domains to see if an
		 * extension is installed using `InstallTrigger.install`. Only priviledged
		 * domains may use the callback.
		 *
		 * @param {int} How long of a timespan the function should check for the extension install at intervalSecs interval rate
		 * @return {promise}
		 */
		FirefoxExtension.prototype.detectInstalled = function(maxTimeout) {
			var defer = $q.defer();
			var that = this;

			var intervalPromise = $interval(function() {
				if (isAvailable()) {
					console.log("Auto install success Firefox extension");
					$interval.cancel(intervalPromise);
					that.initialize();
					defer.resolve("Auto install success Firefox extension");
				} else if (intervalCount * intervalSecs >= maxTimeout) {
					$interval.cancel(intervalPromise);
					defer.reject("Timeout while waiting for extension to become available");
				}
				intervalCount++;
			}, intervalSecs);

			return defer.promise;
		};

		// Create extension api and wait for messages.
		var extension = new FirefoxExtension();

		// Expose.
		return extension;

	}];

});
