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
define(['visibly'], function(visibly) {
	// Visibility
	return [function() {
		var supported = visibly.isSupported();
		return {
			onVisible: visibly.onVisible,
			onHidden: visibly.onHidden,
			hidden: visibly.hidden,
			visibilityState: visibly.visibilityState,
			visibilitychange: visibly.visibilitychange,
			afterPrerendering: function(callback) {
				// Callback triggered as soon as the visibility state is not prerender.
				if (!supported || visibly.visibilityState() !== 'prerender') {
					callback();
					return false;
				}
				var complete = false;
				visibly.visibilitychange(function(state) {
					if (complete) {
						return;
					}
					if (state !== "prerender") {
						complete = true;
						callback();
					}
				});
				return true;
			}
		};
	}];
});
