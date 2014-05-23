/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
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
define(['jquery', 'underscore'], function($, _) {

	return ["$window", function($window) {

		var mediaSources = function() {

			this.supported = window.MediaStreamTrack && window.MediaStreamTrack.getSources
			this.audio = [];
			this.video = [];

		};

		mediaSources.prototype.refresh = function(cb) {

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

		mediaSources.prototype._refresh = function(cb) {

			MediaStreamTrack.getSources(_.bind(function(sources) {
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

		mediaSources.prototype.hasAudioId = function(id) {

			var i;
			for (i = 0; i < this.audio.length; i++) {
				if (this.audio[i].id === id) {
					return true;
				}
			}
			return false;

		};

		mediaSources.prototype.hasVideoId = function(id) {

			var i;
			for (i = 0; i < this.video.length; i++) {
				if (this.video[i].id === id) {
					return true;
				}
			}
			return false;

		};


		return new mediaSources();

	}];

});
