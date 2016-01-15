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

	return ["$window", function($window) {

		var Waiter = function() {
			this.stop = false;
			this.count = 0;
			this.retries = 100;
		};
		Waiter.prototype.start = function(video, stream, cb, err_cb) {
			if (this.stop) {
				if (err_cb) {
					err_cb(video, stream);
				}
				return;
			}
			var videoTracks = stream && stream.getVideoTracks() || [];
			//console.log("wait for video", videoTracks.length, video.currentTime, video.videoHeight, video);
			if (videoTracks.length === 0 && this.count >= 10) {
				cb(false, video, stream);
			} else if (video.currentTime > 0 && video.videoHeight > 0) {
				cb(true, video, stream);
			} else {
				if (videoTracks.length > 0 && this.count >= 10) {
					var videoTrack = videoTracks[0];
					if (videoTrack.enabled === true && videoTrack.muted === true) {
						cb(false, video, stream);
						return;
					}
				}
				this.count++;
				if (this.count < this.retries) {
					$window.setTimeout(_.bind(this.start, this, video, stream, cb, err_cb), 100);
				} else {
					if (err_cb) {
						err_cb(video, stream);
					}
				}
			}
		};
		Waiter.prototype.stop = function() {
			this.stop = true;
		};

		// videoWaiter wait
		return {
			wait: function(video, stream, cb, err_cb) {
				var waiter = new Waiter();
				_.defer(function() {
					waiter.start(video, stream, cb, err_cb);
				});
				return waiter;
			}
		}

	}]


});
