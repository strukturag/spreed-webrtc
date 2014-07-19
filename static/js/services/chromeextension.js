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

	// chromeExtension
	return ["$window", "$q", function($window, $q) {

		var available = false;
		var marker = $window.document.getElementById("chromeextension-available");
		if (marker) {
			available = true;
			console.log("Chrome extension is available.");
		}

		var ChromeExtension = function() {
			this.registry = {};
			this.count = 0;
		};

		ChromeExtension.prototype.call = function(data) {
			var deferred = $q.defer();
			var n = this.count++;
			this.registry[n] = deferred;
			var msg = {
				Type: "Call",
				Call: data,
				n: n
			}
			$window.postMessage(msg, $window.document.URL);
			return deferred.promise;
		};

		ChromeExtension.prototype.onMessage = function(event) {
			var data = event.data;
			switch (data.Type) {
			case "Call":
				var deferred = this.registry[data.n];
				if (deferred) {
					var call = data.Call;
					switch (call.Type) {
					case "Result":
						delete this.registry[data.n];
						//console.log("Call complete with result", call);
						deferred.resolve(call.Result);
						break;
					case "Notify":
						//console.log("Notify", call);
						deferred.notify(call.Notify);
						break;
					case "Error":
						delete this.registry[data.n];
						//console.log("Call failed with error", call);
						deferred.reject(call.Error);
						break
					}
				} else {
					console.warn("Unknown call reference received", data, this.registry, this);
				}
				break;
			default:
				console.log("Unknown message type", data.Type, data);
				break;
			}
		};

		var extension;
		if (available) {
			extension = new ChromeExtension();

			$window.addEventListener("message", function(event) {
				//console.log("message", event.origin, event.source === window, event);
				if (event.source === window && event.data.answer) {
					// Only process answers to avoid loops.
					extension.onMessage(event);
				}
			});

		}

		// public API.
		return {
			available: available,
			call: function(data) {
				return extension.call(data);
			}
		}

	}];

});