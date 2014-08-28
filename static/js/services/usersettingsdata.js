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
define([], function() {

	// userSettingsData
	return ["localStorage", function(localStorage) {

		var UserSettingsData = function(key) {
			this.key = key
		};

		UserSettingsData.prototype.getId = function() {
			return this.key;
		};

		UserSettingsData.prototype.load = function() {
			var raw = localStorage.getItem(this.getId());
			console.log("Found stored user data:", raw);
			if (raw) {
				try {
					return JSON.parse(raw);
				} catch(e) {}
			}
			return null;
		};

		UserSettingsData.prototype.save = function(data) {
			var raw = JSON.stringify(data);
			localStorage.setItem(this.getId(), raw)
		};

		UserSettingsData.prototype.clear = function() {
			localStorage.removeItem(this.getId());
		};

		return new UserSettingsData("mediastream-user");

	}];

});
