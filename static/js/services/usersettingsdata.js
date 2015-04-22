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
define(["sjcl"], function(sjcl) {

	// userSettingsData
	return ["localStorage", "mediaStream", "appData", function(localStorage, mediaStream, appData) {

		var UserSettingsData = function(prefix) {
			this.prefix = prefix
			this.suffix = "";
			this.key = null;
		};

		UserSettingsData.prototype.getId = function() {
			var id = this.prefix;
			if (this.suffix) {
				id = id + "_" + this.suffix;
			}
			return id;
		};

		UserSettingsData.prototype.setEncryption = function(id, secret) {

			if (id) {
				this.key = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(secret+mediaStream.config.Token));
				var hmac = new sjcl.misc.hmac(this.key);
				this.suffix = sjcl.codec.base64.fromBits(hmac.encrypt(id+this.prefix));
			} else {
				this.suffix = "";
				this.key = null;
			}

		};

		UserSettingsData.prototype.load = function() {
			var raw = localStorage.getItem(this.getId());
			if (raw) {
				try {
					if (this.key) {
						raw = sjcl.decrypt(this.key, raw);
					}
					//console.log("Found stored user data:", raw);
					return JSON.parse(raw);
				} catch(e) {
					console.warn("Failed to load stored user data:", e);
				}
			}
			return null;
		};

		UserSettingsData.prototype.save = function(data) {
			var raw = JSON.stringify(data);
			if (this.key) {
				// Encrypt.
				raw = sjcl.encrypt(this.key, raw);
			}
			localStorage.setItem(this.getId(), raw)
		};

		UserSettingsData.prototype.clear = function() {
			localStorage.removeItem(this.getId());
		};

		// Create our default instance.
		var userSettingsData = new UserSettingsData("mediastream-user");

		// Bind to authentication to encrypt stored data per user.
		appData.e.on("authenticationChanged", function(event, userid, suserid) {
			userSettingsData.setEncryption(userid, suserid);
		});

		// public API.
		return {
			load: function() {
				return userSettingsData.load()
			},
			save: function(data) {
				return userSettingsData.save(data);
			},
			clear: function() {
				return userSettingsData.clear()
			}
		};

	}];

});
