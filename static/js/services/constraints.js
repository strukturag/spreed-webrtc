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
 define(["jquery", "underscore"], function($, _) {

	// constraints
	return ["webrtc", "$window", function(webrtc, $window) {

		var service = this;

		var Constraints = function(settings) {
			this.settings = _.clone(settings, true);
			this.pc = [];
			this.audio = [];
			this.video = [];
			this.videoMandatory = {};
			this.screensharing =[];
		};

		Constraints.prototype.add = function(t, k, v, mandatory) {
			if (_.isArray(t)) {
				_.forEach(t, function(x) {
					this.add(x, k, v, mandatory);
				}, this);
				return;
			}
			var obj;
			if (mandatory) {
				t = t + "Mandatory";
			}
			obj = this[t];
			if (!obj) {
				console.warn("Pushed to unknown constraint", t, k, v, mandatory);
			} else {
				if (mandatory) {
					// Mandatory constraints are key/values.
					obj[k] = v;
				} else {
					// Optional constraints are arrays.
					var d = {};
					d[k] = v;
					obj.push(d)
				}
			}
		};

		Constraints.prototype.set = function(t, data, mandatory) {
			if (mandatory) {
				t = t + "Mandatory";
			}
			if (!this[t]) {
				console.warn("Set to unknown constraint", t, data, mandatory);
			} else {
				this[t] = data;
			}
		};

		service.e = $({}); // events

		service.mediaConstraints = function(constraints) {
			webrtc.settings.mediaConstraints.audio = {
				optional: constraints.audio
			};
			webrtc.settings.mediaConstraints.video = {
				optional: constraints.video,
				mandatory: constraints.videoMandatory
			};
			webrtc.settings.screensharing.mediaConstraints.video.optional = constraints.screensharing;
		};

		service.pcConstraints = function(constraints) {
			webrtc.settings.pcConstraints.optional = constraints.pc;
		};

		// Some default constraints.
		service.e.on("refresh", function(event, constraints) {

			if ($window.webrtcDetectedBrowser === "chrome") {
				// NOTE(longsleep): We can always enable SCTP data channels, as we have a workaround
				// using the "active" event for Firefox < 27.
				// SCTP does not work correctly with Chrome 31. Require M32.
				if ($window.webrtcDetectedVersion >= 32) {
					// SCTP is supported from Chrome M31.
					// No need to pass DTLS constraint as it is on by default in Chrome M31.
					// For SCTP, reliable and ordered is true by default.
				} else {
					// Chrome < M32 does not yet do DTLS-SRTP by default whereas Firefox only
					// does DTLS-SRTP. In order to get interop, you must supply Chrome
					// with a PC constructor constraint to enable DTLS.
					console.warn("Turning on SCTP combatibility - please update your Chrome.");
					constraints.add("pc", "DtlsSrtpKeyAgreement", true);
				}
			}

		});

		// Public API.
		return {
			e: service.e,
			refresh: function(settings) {
				var constraints = new Constraints(settings);
				service.e.triggerHandler("refresh", [constraints]);
				service.mediaConstraints(constraints);
				service.pcConstraints(constraints);
			},
			turn: function(turnData) {
				// Set TURN server details.
				service.turn = turnData;
			},
			stun: function(stunData) {
				service.stun = stunData;
			}
		};

	}];

 });