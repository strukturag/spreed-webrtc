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
define(["jquery", "underscore"], function($, _) {

	return ["$window", function($window) {

		var Sandbox = function(iframe, template) {
			this.iframe = iframe;
			this.iframe.src = "data:text/html;charset=utf-8," + encodeURI(template);
			this.target = this.iframe.contentWindow;
			this.e = $({});
			this.handler = _.bind(this.onPostMessageReceived, this);
			$window.addEventListener("message", this.handler, false);
		};

		Sandbox.prototype.destroy = function() {
			if (this.handler) {
				$window.removeEventListener("message", this.handler, false);
				this.handler = null;
			}
		};

		Sandbox.prototype.onPostMessageReceived = function(event) {
			if (event.origin !== "null" || event.source !== this.target) {
				// the sandboxed data-url iframe has "null" as origin
				return;
			}

			this.e.triggerHandler("message", [event]);
		};

		Sandbox.prototype.postMessage = function(type, message) {
			var msg = {"type": type}
			msg[type] = message;
			this.target.postMessage(msg, "*");
		};

		return {
			createSandbox: function(iframe, template) {
				return new Sandbox(iframe, template);
			}
		};

	}];

});
