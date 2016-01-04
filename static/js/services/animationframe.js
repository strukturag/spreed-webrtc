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
define(["underscore", "rAF"], function(_) {

	// animationFrame
	return ["$window", function($window) {

		var requestAnimationFrame = $window.requestAnimationFrame;
		var registry = [];

		var caller;
		var runner;
		var timer;
		var worker;
		var animationFrame;

		caller = function(f) {
			f();
		};
		runner = function(c) {
			registry.forEach(caller);
			requestAnimationFrame(worker)
		}
		timer = $window.setTimeout;
		worker = function() {
			timer(runner, 100);
		};

		// Public api.
		animationFrame = {
			register: function(f) {
				registry.push(f);
			}
		};

		// Auto start worker.
		_.defer(worker);

		return animationFrame;

	}];

});
