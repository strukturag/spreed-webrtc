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
define(['angular', 'underscore'], function(angular, _) {

	// localStatus
	return ["mediaStream", "$window", function(mediaStream, $window) {

		var current = null;
		var commit = false;

		var localStatus = {
			update: function(status) {
				// Put into current.
				if (current && _.isEqual(status, current)) {
					return;
				}
				//console.log("Status update", status);
				current = angular.copy(status);
				if (!commit) {
					commit = true;
					$window.setTimeout(localStatus.commit, 1000)
				}
			},
			commit: function() {
				// TODO(longsleep): Delay the commit until connection has been established for a while and authentication is complete.
				if (commit) {
					commit = false;
					//console.log("Status update commit", current);
					mediaStream.api.updateStatus(current);
				}
			},
			clear: function() {
				current = null;
			},
			get: function() {
				return current;
			}
		};

		return localStatus;

	}];

});
