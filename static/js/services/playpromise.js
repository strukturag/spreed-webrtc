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
	function noopThen() {
		// Automatic playback started.
	}
	function noopCatch(error) {
		// Automatic playback failed.
	}

	// playPromise
	return function() {
		return function(elem, thenFunc, catchFunc) {
			// Starting with Chome 50 play() returns a promise.
			// https://developers.google.com/web/updates/2016/03/play-returns-promise
			var playPromise = elem.play()
			if (playPromise !== undefined) {
				if (!thenFunc) {
					thenFunc = noopThen;
				}
				if (!catchFunc) {
					catchFunc = noopCatch;
				}
				playPromise.then(thenFunc).catch(catchFunc);
			} else {
				if (thenFunc) {
					_.defer(thenFunc);
				}
			}
			return playPromise;
		}
	};
});
