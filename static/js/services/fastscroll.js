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
 * The AngularJS fastscroll service is based on \
 * 60fps-scroll by Ryan Seddon https://github.com/ryanseddon/60fps-scroll
 * which is is released under the MIT license.
 *
 * Copyright (c) 2013 Ryan Seddon
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

"use strict";
define(["jquery"], function($) {

	var dispatchClick = function(coords) {
		var event = document.createEvent('MouseEvent'),
			elem = document.elementFromPoint(coords.x, coords.y);

		event.initMouseEvent(
			'click',
		true /* bubble */ , true /* cancelable */ ,
		window, null,
		coords.x, coords.y, 0, 0, /* coordinates */
		false, false, false, false, /* modifier keys */
		0 /*left*/ , null);
		event.synthetic = true;

		elem.dispatchEvent(event);
	};

	// fastScroll
	return ["$window", function($window) {

		var fastScroll = {
			apply: function(scroller, container) {

				if (!container) {
					container = scroller;
				}

				var cover = $window.document.createElement('div'),
					coverStyle = cover.style,
					scrollStarted = false,
					timer,
					clicked = false,
					pos = {
						x: 0,
						y: 0
					};

				coverStyle.cssText = [
					'-webkit-transform: translate3d(0,0,0);',
					'transform: translate3d(0,0,0);',
					'position: absolute;',
					'top: 0;',
					'right: 0;',
					'left: 0;',
					'bottom: 0;',
					'opacity: 0;',
					'z-index: 9;',
					'pointer-events: none'].join('');
				container.append(cover);

				scroller.on("scroll", function scroll() {
					if (!scrollStarted) {
						coverStyle.pointerEvents = 'auto';
						scrollStarted = true;
					}
					$window.clearTimeout(timer);
					timer = $window.setTimeout(function() {
						coverStyle.pointerEvents = 'none';
						scrollStarted = false;
						if (clicked) {
							dispatchClick(pos);
							clicked = false;
						}
					}, 500);
				});

				// Capture all clicks and store x, y coords for later.
				$(cover).on('click', function clickCatcher(event) {
					if (event.target === cover && !event.synthetic) {
						pos.x = event.clientX;
						pos.y = event.clientY;
						clicked = true;
					}
				});

			}
		}
		return fastScroll;

	}];

});
