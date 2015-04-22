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
define(['underscore', 'text!partials/screensharedialogff.html', 'webrtc.adapter'], function(_, screenshareDialogFF) {

	var screenshareDialogFFController = ["$scope", "$modalInstance", "data", function($scope, $modalInstance, data) {
		$scope.data = data;
		$scope.cancel = function() {
			$modalInstance.close(null);
		};
		$scope.ok = function() {
			$modalInstance.close($scope.data.selection);
		};
	}];

	// screensharing
	return ["$window", "$q", "$timeout", "chromeExtension", "dialogs", "$templateCache", function($window, $q, $timeout, chromeExtension, dialogs, $templateCache) {

		$templateCache.put('/dialogs/screensharedialogff.html', screenshareDialogFF);

		var Screensharing = function() {
			this.autoinstall = false;
			this.initialize();
			chromeExtension.e.on("available", _.bind(function() {
				this.initialize();
			}, this));
		};

		Screensharing.prototype.initialize = function() {

			// Check if we can do screensharing.
			this.supported = false;

			// Define our helpers.
			this.prepare = null;
			this.cancel = null;

			// Chrome support.
			if ($window.webrtcDetectedBrowser === "chrome") {

				if ($window.webrtcDetectedVersion >= 32 &&
					$window.webrtcDetectedVersion < 37) {
					// Support for flag based developer screen sharing came in Chrome 32.
					// It was removed in Chrome 37 in favour of chrome.chooseDesktopMedia
					// https://code.google.com/p/chromium/issues/detail?id=347641
					this.supported = true;
					this.prepare = function(options) {
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

					this.supported = true;
					var pending = null;
					this.prepare = function(options) {
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
					this.cancel = function() {
						if (pending !== null) {
							chromeExtension.call({
								Type: "Action",
								Action: "cancelChooseDesktopMedia",
								Args: pending
							});
							pending = null;
						}
					};

				} else {

					// Check if we always should do autoinstall if the extension is not there.
					if (chromeExtension.autoinstall.force) {
						this.supported = false;
					}

				}

			} else if ($window.webrtcDetectedBrowser === "firefox") {

				// Firefox 36 got screen sharing support.
				// See https://bugzilla.mozilla.org/show_bug.cgi?id=923225
				if ($window.webrtcDetectedVersion >= 36) {
					this.supported = true;
					this.prepare = function(options) {
						// To work, the current domain must be whitelisted in
						// media.getusermedia.screensharing.allowed_domains (about:config).
						// See https://wiki.mozilla.org/Screensharing for reference.
						var d = $q.defer();
						var dlg = dialogs.create('/dialogs/screensharedialogff.html', screenshareDialogFFController, {selection: "screen"}, {});
						dlg.result.then(function(source) {
							if (source) {
								var opts = _.extend({
									mediaSource: source
								}, options);
								d.resolve(opts);
							} else {
								d.resolve(null);
							}
						}, function(err) {
							d.resolve(null);
						});
						return d.promise;
					};
				}

			} else {
				// No support for screen sharing.
			}

			// Auto install support.
			if (!this.supported && chromeExtension.autoinstall.install) {
				this.supported = this.autoinstall = true;
				var that = this;
				var waiting = false;
				var prepareAlternative = this.prepare;
				this.prepare = function(options) {
					var d = $q.defer();
					var install = chromeExtension.autoinstall.install();
					install.then(function() {
						// Seems we triggered install - this can take a while.
						console.log("Auto install success");
						waiting = true;
						$timeout(function() {
							var starter = function() {
								waiting = false;
								var prepare = that.prepare(options);
								prepare.then(function(id) {
									d.resolve(id);
								}, function(err) {
									d.reject(err);
								});
							};
							if (!that.autoinstall && that.supported) {
								// Got something.
								starter();
							} else {
								// Wait for it.
								chromeExtension.e.one("available", function() {
									$timeout(function() {
										if (waiting && !that.autoinstall && that.supported) {
											starter();
										}
									}, 0);
								});
							}
						}, 100);
						// The installation has been installed, but initialization might not work
						$timeout(function() {
							if (waiting) {
								waiting = false;
								d.reject("Timeout while waiting for extension to become available");
							}
						}, 30000);
					}, function(err) {
						console.log("Auto install of extension failed.", err);
						if (prepareAlternative) {
							var alternative = prepareAlternative(options);
							alternative.then(function(id) {
								d.resolve(id);
							}, function() {
								d.reject(err);
							});
						} else {
							d.reject(err);
						}
					});
					return d.promise;
				};
				this.cancel = function() {
					if (chromeExtension.autoinstall.cancel) {
						chromeExtension.autoinstall.cancel();
					}
					waiting = false;
				};
			} else {
				this.autoinstall = false;
			}

			console.log("Screensharing support", this.supported, this.autoinstall ? "autoinstall" : "");

		};

		Screensharing.prototype.getScreen = function(options) {
			if (this.prepare) {
				return this.prepare(options);
			} else {
				var d = $q.defer()
				d.reject("No implementation to get screen.");
				return d.promise;
			}
		};

		Screensharing.prototype.cancelGetScreen = function() {
			if (this.cancel) {
				this.cancel();
			}
		};



		// Expose.
		var screensharing = new Screensharing();
		return screensharing;

	}];

});
