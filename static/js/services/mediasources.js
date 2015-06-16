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
define(['jquery', 'underscore'], function($, _) {

	return ["$window", function($window) {

		var MediaSources = function() {

			this.supported = $window.MediaStreamTrack && $window.MediaStreamTrack.getSources
			this.audio = [];
			this.video = [];

		};

		MediaSources.prototype.refresh = function(cb) {

			if (!this.supported) {
				if (cb) {
					cb([], []);
				}
				return;
			}

			// NOTE(longsleep): Put this in a try/catch to continue with
			// broken implementation like in node-webkit 0.7.2.
			try {
				this._refresh(cb);
			} catch (e) {
				console.error("Failed to get media sources: " + e.message);
				this.supported = false;
				if (cb) {
					cb([], []);
				}
			}

		};

		MediaSources.prototype._refresh = function(cb) {

			$window.MediaStreamTrack.getSources(_.bind(function(sources) {
				var audio = this.audio = [];
				var video = this.video = [];
				_.each(sources, function(source) {
					var o = {
						id: source.id,
						facing: source.facing
					};
					if (source.kind === "audio") {
						o.label = source.label ? source.label : "Microphone " + (audio.length + 1);
						audio.push(o);
					} else if (source.kind === "video") {
						o.label = source.label ? source.label : "Camera " + (video.length + 1);
						video.push(o);
					}
				});
				if (cb) {
					cb(audio, video);
				}
			}, this));

		};

		MediaSources.prototype.hasAudioId = function(id) {

			var i;
			for (i = 0; i < this.audio.length; i++) {
				if (this.audio[i].id === id) {
					return true;
				}
			}
			return false;

		};

		MediaSources.prototype.hasVideoId = function(id) {

			var i;
			for (i = 0; i < this.video.length; i++) {
				if (this.video[i].id === id) {
					return true;
				}
			}
			return false;

		};

		MediaSources.prototype.hasVideo = function() {

			return !this.supported || this.video.length > 0;

		};

		MediaSources.prototype.hasAudio = function() {

			return !this.supported || this.audio.length > 0;

		};


		return new MediaSources();

	}];

});
