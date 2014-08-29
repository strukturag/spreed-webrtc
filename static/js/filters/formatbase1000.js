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

	// formatBase1000
	/* Purpose: format number/unit appropriately.
		Appends k+base-unit, base-unit, c+base-unit, m+base-unit to value depending input.
		when Number >= 1 and !base-unit: no decimal is used
		when Number < 1: 2 places decimal accuracy
		Using: Number | formatBase1000[:'base-unit']
	*/
	return [function() {
		var defaultPrecisionBaseAndOver = 0;
		var defaultPrecisionUnderBase = 2;
		return function(num, unit) {
			num = Number(num);
			var getNumber = function(precision) {
				var dot = num.toString().search(/\./);
				if (dot === -1) {
					precision += num.toString().length;
				} else {
					precision += dot;
				}
				return num.toPrecision(precision);
			};
			if (!unit) {
				return getNumber(defaultPrecisionBaseAndOver);
			}
			// killo
			if (num >= 1000) {
				num /= 1000;
				return getNumber(defaultPrecisionBaseAndOver) + 'k' + unit;
			// centi
			} else if (num < 1 && num >= 0.01) {
				num *= 100;
				return getNumber(defaultPrecisionUnderBase) + 'c' + unit;
			// milli
			} else if (num < 0.01) {
				num *= 1000;
				return getNumber(defaultPrecisionUnderBase) + 'm' + unit;
			// base
			} else {
				return getNumber(defaultPrecisionBaseAndOver) + unit;
			}
		};
	}];

});
