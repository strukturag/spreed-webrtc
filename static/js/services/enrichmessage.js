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

	// enrichMessage
	return ["$filter", function($filter) {

		var linky = $filter("linky");
		var enrichMessage = {
			url: function(s) {
				s = linky(s);
				s = s.replace(/<a/g, '<a rel="external"');
				return s;
			},
			multiline: function(s) {
				s = s.replace(/\r\n/g, "<br/>");
				s = s.replace(/\n/g, "<br/>");
				s = s.replace(/&#10;/g, "<br/>"); // Also supported quoted newlines.
				return s;
			},
			all: function(s) {
				s = enrichMessage.url(s);
				s = enrichMessage.multiline(s);
				return s;
			}
		};
		return enrichMessage;

	}];

});
