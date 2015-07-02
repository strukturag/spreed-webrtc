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
define(["underscore"], function(_) {

	// restURL
	return ["globalContext", "$window", function(context, $window) {
		var RestURL = function() {};
		RestURL.prototype.room = function(name) {
			var url = this.encodeRoomURL(name);
			return $window.location.protocol + '//' + $window.location.host + context.Cfg.B + url;
		};
		RestURL.prototype.buddy = function(id) {
			return $window.location.protocol + '//' + $window.location.host + context.Cfg.B + "static/img/buddy/s46/" + id;
		};
		RestURL.prototype.api = function(path) {
			return (context.Cfg.B || "/") + "api/v1/" + path;
		};
		RestURL.prototype.sandbox = function(sandbox) {
			return (context.Cfg.B || "/") + "sandbox/" + $window.location.protocol + "/" + $window.location.host + "/" + sandbox + ".html";
		};
		RestURL.prototype.encodeRoomURL = function(name, prefix, cb) {
			// Split parts so slashes are allowed.
			var parts = name.split("/");
			var url = [];
			var nn = [];
			if (typeof prefix !== "undefined") {
				url.push(prefix);
			}
			// Allow some things in room name parts.
			_.each(parts, function(p) {
				if (p === "") {
					// Skip empty parts, effectly stripping spurious slashes.
					return;
				}
				nn.push(p);
				// URL encode.
				p = $window.encodeURIComponent(p);
				// Encode back certain stuff we allow.
				p = p.replace(/^%40/, "@");
				p = p.replace(/^%24/, "$");
				p = p.replace(/^%2B/, "+");
				url.push(p);
			});
			if (cb) {
				cb(url.join("/"));
				return nn.join("/");
			}
			return url.join("/");
		};
		RestURL.prototype.createAbsoluteUrl = function(url) {
			var link = $window.document.createElement("a");
			link.href = url;
			return link.href;
		};
		return new RestURL();
	}];
});
