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
define(['underscore', 'Howler', 'require'], function(_, Howler, require) {

	var SoundInterval = function(sound, id, time) {
		this.sound = sound;
		this.id = id;
		this.interval = null;
		this.time = time;
	};
	SoundInterval.prototype.start = function() {
		if (this.interval !== null) {
			return;
		}
		var id = this.id;
		var player = _.bind(function() {
			return this.sound.play(id);
		}, this);
		player();
		this.interval = setInterval(player, this.time);
	};
	SoundInterval.prototype.stop = function() {
		clearInterval(this.interval);
		this.interval = null;
		delete this.sound.intervals[this.id];
	};

	var Sound = function(options, aliases) {

		this.sound = null;
		this.intervals = {};
		if (options) {
			this.initialize(options, aliases);
		}

	};

	Sound.prototype.initialize = function(options, aliases) {

		// Kill all the existing stuff if any.
		if (this.sound) {
			this.sound.stop();
		}
		_.each(this.intervals, function(i) {
			i.stop();
		});
		this.intervals = {};

		// Add error handler.
		var onloaderror = options.onloaderror;
		options.onloaderror = function(event) {
			console.error("Failed to load sounds", event);
			if (onloaderror) {
				onloaderror.apply(this, arguments);
			}
		};

		// Replace urls with their require generated URLs.
		var urls = options.urls;
		if (urls) {
			var new_urls = [];
			_.each(urls, function(u) {
				u = require.toUrl(u);
				new_urls.push(u);
			});
			options.urls = new_urls;
		}

		// Create the new shit.
		this.players = {};
		this.aliases = _.extend({}, aliases);
		this.sound = new Howler.Howl(options);

		return this;

	};

	Sound.prototype.getId = function(id) {

		if (this.aliases.hasOwnProperty(id)) {
			return this.aliases[id];
		}
		return id;

	};


	Sound.prototype.play = function(id, interval, autostart) {

		if (!this.sound) {
			console.log("Play sound but not initialized.", id);
			return null;
		}

		id = this.getId(id);

		if (interval) {

			if (this.intervals.hasOwnProperty(id)) {
				return this.intervals[id];
			}
			var i = this.intervals[id] = new SoundInterval(this, id, interval);
			if (autostart) {
				i.start();
			}
			return i;

		} else {

			var player = this.players[id];
			var sound = this.sound;
			if (!player) {
				player = this.players[id] = (function(id) {
					var data = {};
					var cb = function(soundId) {
						data.soundId = soundId;
					};
					var play = _.debounce(function() {
						if (data.soundId) {
							sound.stop(data.soundId);
							data.soundId = null;
						}
						sound.play(id, cb);
					}, 10);
					return play;
				}(id));
			}
			player()

		}

	};

	// Active initialized sound instances are kept here.
	var registry = {};
	window.PLAYSOUND = registry; // make available for debug.

	// playSound
	return [function() {

		return {
			initialize: function(options, name, aliases) {
				if (!name) {
					name = null;
				}
				var s = registry[name] = new Sound(options, aliases);
				return s;
			},
			play: function(id, name) {
				if (!name) {
					name = null;
				}
				var s = registry[name];
				if (!s) {
					console.log("Play sound with unknown player", name);
					return null;
				}
				return s.play(id);

			},
			interval: function(id, name, time) {
				if (!name) {
					name = null;
				}
				var s = registry[name];
				if (!s) {
					console.log("Play sound with unknown player", name);
					return null;
				}
				if (!time) {
					time = 1500;
				}
				return s.play(id, time);
			}
		}

	}];

});
