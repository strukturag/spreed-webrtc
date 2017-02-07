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

		var Waiter = function(video, stream, cb, err_cb) {
			this.stop = false;
			this.triggered = false;
			this.count = 0;
			this.retries = 100;

			this.video = video;
			this.stream = stream;
			this.cb = cb;
			this.err_cb = err_cb;
		};
		Waiter.prototype.trigger = function() {
			var oldTriggered = this.triggered;
			this.triggered = true;
			return oldTriggered;
		};
		Waiter.prototype.error = function() {
			var triggered = this.trigger();
			if (this.err_cb) {
				this.err_cb(this.video, this.stream, triggered);
			}
		};
		Waiter.prototype.found = function(withvideo) {
			var triggered = this.trigger();
			this.cb(withvideo, triggered);
		};
		Waiter.prototype.start = function() {
			if (this.stop) {
				this.error();
				return;
			}
			var recheck = _.bind(this.start, this);
			var videoTracks = this.stream && this.stream.getVideoTracks() || [];
			//console.log("wait for video", videoTracks.length, video.currentTime, video.videoHeight, video);
			if (videoTracks.length === 0 && this.count >= 10) {
				this.found(false);
			} else if (this.video.currentTime > 0 && this.video.videoHeight > 0) {
				this.found(true);
			} else {
				if (videoTracks.length > 0 && this.count >= 10) {
					var videoTrack = videoTracks[0];
					if (videoTrack.enabled === true && videoTrack.muted === true) {
						videoTrack.onunmute = function() {
							videoTrack.onunmute = undefined;
							_.defer(recheck);
						};
						this.found(false);
						return;
					}
				}
				this.count++;
				if (this.count < this.retries) {
					$window.setTimeout(recheck, 100);
				} else {
					this.error();
				}
			}
		};
		Waiter.prototype.stop = function() {
			this.stop = true;
		};

		// videoWaiter wait
		return {
			wait: function(video, stream, cb, err_cb) {
				var waiter = new Waiter(video, stream, cb, err_cb);
				_.defer(function() {
					waiter.start();
				});
				return waiter;
			}
		}

	}]

});
