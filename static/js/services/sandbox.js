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
			var blob = new $window.Blob([template], {type: "text/html;charset=utf-8"});
			this.url = $window.URL.createObjectURL(blob);
			this.iframe.src = this.url;
			this.target = this.iframe.contentWindow;
			this.e = $({});
			this.handler = _.bind(this.onPostMessageReceived, this);
			this.ready = false;
			this.pending_messages = [];
			this.origin = $window.location.protocol + "//" + $window.location.host;
			$window.addEventListener("message", this.handler, false);
		};

		Sandbox.prototype.destroy = function() {
			if (this.handler) {
				$window.removeEventListener("message", this.handler, false);
				this.handler = null;
			}
			if (this.url) {
				$window.URL.revokeObjectURL(this.url);
				this.url = null;
			}
		};

		Sandbox.prototype.onPostMessageReceived = function(event) {
			if ((event.origin !== "null" && event.origin !== this.origin) || event.source !== this.target) {
				// the sandboxed data-url iframe has "null" as origin
				return;
			}

			if (event.data.type === "ready") {
				this.ready = true;
				this._sendPendingMessages();
			}

			this.e.triggerHandler("message", [event]);
		};

		Sandbox.prototype._sendPendingMessages = function() {
			var i;
			for (i=0; i<this.pending_messages.length; i++) {
				var entry = this.pending_messages[i];
				this.postMessage(entry[0], entry[1]);
			}
			this.pending_messages = [];
		};

		Sandbox.prototype.postMessage = function(type, message) {
			if (!this.ready) {
				this.pending_messages.push([type, message]);
				return;
			}
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
