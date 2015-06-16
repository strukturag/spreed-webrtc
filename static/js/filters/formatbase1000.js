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
define([], function() {

	// formatBase1000
	/* Purpose: format number/unit appropriately.
		Appends k+base-unit, base-unit, c+base-unit, m+base-unit to value depending on input.
		Decimal accuracy is taken care of automatically but override is avaible.
		Using: Number | formatBase1000[:'base-unit'][:'desired-precision']
	*/
	return [function() {
		var defaultPrecisionUnder1 = 2;
		var defaultPrecisionFrom1AndUnder10 = 2;
		var defaultPrecisionFrom10AndUnder100 = 1;
		var defaultPrecisionFrom100AndOver = 0;
		return function(num, unit, precision) {
			num = Number(num);
			precision = Number(precision);
			var getNumber = function(precision) {
				var dot = num.toString().search(/\./);
				if (dot === -1) {
					precision += num.toString().length;
				} else {
					precision += dot;
				}
				// toPrecision supports range 1 - 21
				if (precision > 21) {
					precision = 21;
				}
				return num.toPrecision(precision);
			};
			var getPrecision = function() {
				if (!isNaN(precision)) {
					return precision;
				}
				if (num >= 100) {
					return defaultPrecisionFrom100AndOver;
				} else if (num < 100 && num >= 10) {
					return defaultPrecisionFrom10AndUnder100;
				} else if (num < 10 && num >= 1){
					return defaultPrecisionFrom1AndUnder10;
				} else {
					return defaultPrecisionUnder1;
				}
			};
			if (!unit) {
				return getNumber(getPrecision());
			}
			// kilo
			if (num >= 1000) {
				num /= 1000;
				return getNumber(getPrecision()) + 'k' + unit;
			// centi
			} else if (num < 1 && num >= 0.01) {
				num *= 100;
				return getNumber(getPrecision()) + 'c' + unit;
			// milli
			} else if (num < 0.01) {
				num *= 1000;
				return getNumber(getPrecision()) + 'm' + unit;
			// base
			} else {
				return getNumber(getPrecision()) + unit;
			}
		};
	}];

});
