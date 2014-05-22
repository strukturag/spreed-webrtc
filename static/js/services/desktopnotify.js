/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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
define(['jquery', 'underscore', 'desktop-notify'], function($, _) {

	return ["$window", function($window) {

		var helper = notify;

		var desktopNotify = function() {

			this.asked = false;
			this.windowHasFocus = true;
			this.dummy = {
				close: function() {}
			};
			this.refresh();
			this.enabled();

			$($window).on("focus blur", _.bind(function(event) {
				this.windowHasFocus = event.type === "focus" ? true : false;
			}, this));

		};

		desktopNotify.prototype.enabled = function() {

			if (this.level === "default") {
				this.asked = true;
				this.requestPermission();
			}
			return (this.supported && this.level === "granted") ? true : false;

		};

		desktopNotify.prototype.refresh = function() {

			this.supported = helper.isSupported;
			this.level = helper.permissionLevel();

		};

		desktopNotify.prototype.requestPermission = function(cb) {

			//console.log("request permission");
			return helper.requestPermission(_.bind(function() {

				//console.log("requestPermission result", arguments);
				this.refresh();
				if (cb) {
					cb.apply(helper, arguments);
				}

			}, this));

		};

		desktopNotify.prototype.createNotification = function(title, options) {

			return helper.createNotification(title, options);

		};

		desktopNotify.prototype.notify = function(title, body, options) {

			if (!this.enabled()) {
				return this.dummy;
			}

			var opts = {
				body: body,
				icon: "static/img/notify.ico",
				timeout: 7000
			}
			$.extend(opts, options);
			var timeout = opts.timeout;
			delete opts.timeout;
			var n = this.createNotification(title, opts);
			if (timeout) {
				$window.setTimeout(function() {
					n.close();
				}, timeout);
			}
			return n;

		};

		return new desktopNotify();

	}];

});
