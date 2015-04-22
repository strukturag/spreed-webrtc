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
define([
	'underscore',

	'filters/displayname',
	'filters/buddyimagesrc',
	'filters/displayconference',
	'filters/displayuserid',
	'filters/displaynameforsession',
	'filters/formatbase1000'], function(_, displayName, buddyImageSrc, displayConference, displayUserid, displayNameForSession, formatBase1000) {

	var filters = {
		displayName: displayName,
		buddyImageSrc: buddyImageSrc,
		displayConference: displayConference,
		displayUserid: displayUserid,
		displayNameForSession: displayNameForSession,
		formatBase1000: formatBase1000
	};

	var initialize = function(angModule) {
		_.each(filters, function(filter, name) {
			angModule.filter(name, filter);
		})
	}

	return {
		initialize: initialize
	};

});
