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
define(['underscore', 'modernizr'], function(_, Modernizr) {

	var supported = Modernizr.geolocation;

	// geolocation
	return [function() {

		var defaults = {
			enableHighAccuracy: true,
			timeout: 5000,
			maximumAge: 0
		};

		return {
			getCurrentPosition: function(success, error, options) {
				if (!supported) {
					if (error) {
						error(new Error("geolocation api is not supported"));
					}
					return
				}
				var opts = _.extend({}, defaults, options);
				navigator.geolocation.getCurrentPosition(success, error, opts);
			}
		}

	}];

});
