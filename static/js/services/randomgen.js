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

	// randomGen
	return ["$window", function($window) {

		var getRandomValues;
		if ($window.crypto && $window.crypto.getRandomValues) {
			getRandomValues = _.bind($window.crypto.getRandomValues, $window.crypto);
		}

		// Simple id generator. Do not use for crypto.
		var makeRandomId = function() {
			return (Math.random() + 1).toString(36).substr(2, 7);
		};

		// Fast binary to hex function.
		var binStringToHex = function(s) {
			var s2 = '',
				c;
			for (var i = 0, l = s.length; i < l; ++i) {
				c = s.charCodeAt(i);
				s2 += (c >> 4).toString(16);
				s2 += (c & 0xF).toString(16);
			}
			return s2;
		};

		// Public api.
		var randomGen = {
			id: makeRandomId,
			random: (function() {
				if (getRandomValues) {
					return function(options) {
						var opts = _.extend({}, options);
						var d = new Uint8Array(16);
						getRandomValues(d);
						var s = String.fromCharCode.apply(null, d);
						if (opts.hex) {
							return binStringToHex(s);
						} else {
							return s;
						}
					};
				} else {
					return makeRandomId;
				}
			}()),
			binStringToHex: binStringToHex
		};

		return randomGen;

	}];

});
