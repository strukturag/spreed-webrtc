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
define(["modernizr"], function(Modernizr) {

	// localStorage
	return ["$window", function($window) {

		// PersistentStorage (c)2015 struktur AG. MIT license.
		var PersistentStorage = function(prefix) {
			this.prefix = prefix ? prefix : "ps";
			this.isPersistentStorage = true;
		};
		PersistentStorage.prototype.setItem = function(key, data) {
			var name = this.prefix+"_"+key;
			$window.document.cookie = name + "=" + data + "; path=/";
		};
		PersistentStorage.prototype.getItem = function(key) {
			var name = this.prefix+"_"+key+"=";
			var ca = $window.document.cookie.split(';');
			for (var i=0; i<ca.length; i++) {
				var c = ca[i].trim();
				if (c.indexOf(name) === 0) {
					return c.substring(name.length, c.length);
				}
			}
			return null;
		};
		PersistentStorage.prototype.removeItem = function(key) {
			var name = this.prefix+"_"+key;
			$window.document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/";
		};

		var storage;
		if (Modernizr.localstorage) {
			storage = $window.localStorage;
		} else {
			storage = new PersistentStorage();
		}

		// public API.
		return {
			setItem: function(key, data) {
				return storage.setItem(key, data);
			},
			getItem: function(key) {
				return storage.getItem(key);
			},
			removeItem: function(key) {
				return storage.removeItem(key);
			}
		}

	}];

});
