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

"use strict";
define(['jquery', 'underscore', 'audiocontext', 'webrtc.adapter'], function($, _, AudioContext) {

	// Create AudioContext singleton, if supported.
	var context = AudioContext ? new AudioContext() : null;
	var peerconnections = {};

	// Disabled for now until browser support matures. If enabled this totally breaks
	// Firefox and Chrome with Firefox interop.
	var enableRenegotiationSupport = false;

	// Converter helpers to convert media constraints to new API.
	var mergeConstraints = function(constraints, k, v, mandatory) {
		var prefix = k.substring(0, 3);
		switch (prefix) {
		case "min":
		case "max":
			var suffix = k[3].toLowerCase()+k.substring(4);
			if (!constraints.hasOwnProperty(suffix)) {
				constraints[suffix]={};
			}
			if (mandatory && prefix === "min" && constraints[suffix].hasOwnProperty(prefix)) {
				// Use existing min constraint as ideal.
				constraints[suffix].ideal = constraints[suffix].min;
			}
			constraints[suffix][prefix]=v;
			break;
		default:
			constraints[k] = v;
			break;
		}
	};
	var convertConstraints = function(constraints) {
		if (!constraints) {
			return false;
		}
		if (!constraints.hasOwnProperty("optional") && !constraints.hasOwnProperty("mandatory")) {
			// No old style members.
			return constraints;
		}
		var c = {};
		// Process optional constraints.
		if (constraints.optional) {
			_.each(constraints.optional, function(o) {
				_.each(o, function(v, k) {
					mergeConstraints(c, k, v);
				})
			});
		}
		// Process mandatory constraints.
		if (constraints.mandatory) {
			_.each(constraints.mandatory, function(v, k) {
				mergeConstraints(c, k, v, true);
			});
		}
		// Fastpath.
		if (_.isEmpty(c)) {
			return true;
		}
		// Use ideal if there is only one value set.
		_.each(c, function(v, k) {
			if (_.isObject(v)) {
				var values = _.values(v);
				if (values.length === 1) {
					// Use as ideal value if only one given.
					c[k] = {ideal: values[0]};
				}
			}
		});
		if (window.webrtcDetectedBrowser === "firefox" && window.webrtcDetectedVersion < 38) {
			// Firefox < 38 needs a extra require field.
			var r = [];
			if (c.height) {
				r.push("height");
			}
			if (c.width) {
				r.push("width");
			}
			if (r.length) {
				c.require = r;
			}
		}
		return c;
	};
	// Adapter to support navigator.mediaDevices API.
	// http://w3c.github.io/mediacapture-main/getusermedia.html#mediadevices
	var getUserMedia = (function() {
		if (window.navigator.mediaDevices) {
			console.info("Enabled mediaDevices adapter ...");
			return function(constraints, success, error) {
				// Full constraints syntax with plain values and ideal-algorithm supported in FF38+.
				// Note on FF32-37: Plain values and ideal are not supported.
				// See https://wiki.mozilla.org/Media/getUserMedia for details.
				// Examples here: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
				var c = {audio: convertConstraints(constraints.audio), video: convertConstraints(constraints.video)};
				// mediaDevices API returns a promise.
				console.log("Constraints for mediaDevices", c);
				window.navigator.mediaDevices.getUserMedia(c).then(success).catch(error);
			}
		} else {
			// Use existing adapter.
			return window.getUserMedia;
		}
	})();

	var UserMedia = function(options) {

		this.options = $.extend({}, options);
		this.e = $({}); // Events.

		this.localStream = null;
		this.started = false;
		this.delay = 0;

		this.audioMute = false;
		this.videoMute = false;
		this.mediaConstraints = null;

		// Audio level.
		this.audioLevel = 0;
		if (!this.options.noaudio && context && context.createScriptProcessor) {

			this.audioSource = null;
			this.audioProcessor = context.createScriptProcessor(2048, 1, 1);
			this.audioProcessor.onaudioprocess = _.bind(function(event) {
				// Compute audio input level based on raw PCM data.
				if (!this.audioSource) {
					return;
				}
				var input = event.inputBuffer.getChannelData(0);
				var len = input.length
				var total = 0;
				var i = 0;
				while (i < len) {
					total += Math.abs(input[i++]);
				}
				// http://en.wikipedia.org/wiki/Root_mean_square
				var rms = Math.sqrt(total / len);
				this.audioLevel = rms;
				//console.log("this.audioLevel", this.audioLevel);
			}, this);

			// Connect stream to audio processor if supported.
			if (context.createMediaStreamSource) {
				this.e.on("localstream", _.bind(function(event, stream) {
					if (this.audioSource) {
						this.audioSource.disconnect();
					}
					// Connect to audioProcessor.
					this.audioSource = context.createMediaStreamSource(stream);
					//console.log("got source", this.audioSource);
					this.audioSource.connect(this.audioProcessor);
					this.audioProcessor.connect(context.destination);
				}, this));
			}

		}

		this.e.on("localstream", _.bind(function(event, stream, oldstream) {
			// Update stream support.
			if (oldstream) {
				_.each(peerconnections, function(pc) {
					pc.removeStream(oldstream);
					pc.addStream(stream);
					console.log("Updated usermedia stream at peer connection", pc, stream);
				});
			}
		}, this));

	};

	// Static.
	UserMedia.testGetUserMedia = function(success_cb, error_cb) {

		console.log("Requesting testGetUserMedia");
		(function(complete) {
			var timeout = null;
			var success_helper = function(stream) {
				if (timeout) {
					clearTimeout(timeout);
					timeout = null;
				}
				stream.stop();
				if (complete.done) {
					return;
				}
				complete.done = true;
				var args = Array.prototype.slice.call(arguments, 1);
				success_cb.apply(this, args);
			};
			var error_helper = function() {
				if (timeout) {
					clearTimeout(timeout);
					timeout = null;
				}
				if (complete.done) {
					return;
				}
				complete.done = true;
				var args = Array.prototype.slice.call(arguments, 1);
				error_cb.apply(this, args);
			};
			try {
				getUserMedia({
					video: true,
					audio: true
				}, success_helper, error_helper);
			} catch (e) {
				console.error('getUserMedia failed with exception: ' + e.message);
				error_helper(e);
			}
			timeout = setTimeout(function() {
				var e = new Error("Timeout while waiting for getUserMedia");
				console.error('getUserMedia timed out');
				error_helper(e);
			}, 10000);
		})({});

	};

	UserMedia.prototype.doGetUserMedia = function(currentcall, mediaConstraints) {

		if (!mediaConstraints) {
			mediaConstraints = currentcall.mediaConstraints;
		}
		this.mediaConstraints = mediaConstraints;

		return this.doGetUserMediaWithConstraints(mediaConstraints);

	};

	UserMedia.prototype.doGetUserMediaWithConstraints = function(mediaConstraints) {

		if (!mediaConstraints) {
			mediaConstraints = this.mediaConstraints;
		}

		var constraints = $.extend(true, {}, mediaConstraints);
		if (this.audioMute) {
			constraints.audio = false;
		}
		if (this.videoMute) {
			constraints.video = false;
		}

		try {
			console.log('Requesting access to local media with mediaConstraints:\n' +
				'  \'' + JSON.stringify(constraints) + '\'', constraints);
			getUserMedia(constraints, _.bind(this.onUserMediaSuccess, this), _.bind(this.onUserMediaError, this));
			this.started = true;
			return true;
		} catch (e) {
			console.error('getUserMedia failed with exception: ' + e.message);
			return false;
		}

	};

	UserMedia.prototype.onUserMediaSuccess = function(stream) {
		console.log('User has granted access to local media.');

		if (!this.started) {
			stream.stop();
			return;
		}

		this.onLocalStream(stream);

	};

	UserMedia.prototype.onUserMediaError = function(error) {
		console.error('Failed to get access to local media. Error was ' + error.name, error);

		if (!this.started) {
			return;
		}

		// Let webrtc handle the rest.
		this.e.triggerHandler("mediaerror", [this, error]);

	};

	UserMedia.prototype.onLocalStream = function(stream) {

		var oldStream = this.localStream;
		if (oldStream) {
			oldStream.onended = function() {};
			oldStream.stop();
			setTimeout(_.bind(function() {
				this.e.triggerHandler("mediachanged", [this]);
			}, this), 0);
		} else {
			// Let webrtc handle the rest.
			setTimeout(_.bind(function() {
				this.e.triggerHandler("mediasuccess", [this]);
			}, this), this.delay);
		}

		// Get notified of end events.
		stream.onended = _.bind(function(event) {
			console.log("User media stream ended.");
			if (this.started) {
				this.stop();
			}
		}, this);

		// Set new stream.
		this.localStream = stream;
		this.e.triggerHandler("localstream", [stream, oldStream, this]);

	};

	UserMedia.prototype.stop = function() {

		this.started = false;

		if (this.audioSource) {
			this.audioSource.disconnect();
			this.audioSource = null;
		}
		if (this.localStream) {
			this.localStream.stop()
			this.localStream = null;
		}
		if (this.audioProcessor) {
			this.audioProcessor.disconnect()
		}
		this.audioLevel = 0;
		this.audioMute = false;
		this.videoMute = false;
		this.mediaConstraints = null;
		console.log("Stopped user media.");
		this.e.triggerHandler("stopped", [this]);

		this.delay = 1500;
		setTimeout(_.bind(function() {
			this.delay = 0;
		}, this), 2000);

	};

	UserMedia.prototype.applyAudioMute = function(mute) {

		var m = !!mute;

		if (!enableRenegotiationSupport) {

			// Disable streams only - does not require renegotiation but keeps mic
			// active and the stream will transmit silence.

			if (this.localStream) {

				var audioTracks = this.localStream.getAudioTracks();
				if (audioTracks.length === 0) {
					//console.log('No local audio available.');
					return;
				}

				for (var i = 0; i < audioTracks.length; i++) {
					audioTracks[i].enabled = !mute;
				}

				if (mute) {
					console.log("Local audio muted by disabling audio tracks.");
				} else {
					console.log("Local audio unmuted by enabling audio tracks.");
				}

			}

		} else {

			// Remove audio stream, by creating a new stream and doing renegotiation. This
			// is the way to go to disable the mic when audio is muted.

			if (this.localStream) {
				if (this.audioMute !== m) {
					this.audioMute = m;
					this.doGetUserMediaWithConstraints();
				}
			} else {
				this.audioMute = m;
			}

		}

		return m;

	};

	UserMedia.prototype.applyVideoMute = function(mute) {

		var m = !!mute;

		if (!enableRenegotiationSupport) {

			// Disable streams only - does not require renegotiation but keeps camera
			// active and the stream will transmit black.

			if (this.localStream) {
				var videoTracks = this.localStream.getVideoTracks();
				if (videoTracks.length === 0) {
					//console.log('No local video available.');
					return;
				}

				for (var i = 0; i < videoTracks.length; i++) {
					videoTracks[i].enabled = !mute;
				}

				if (mute) {
					console.log("Local video muted by disabling video tracks.");
				} else {
					console.log("Local video unmuted by enabling video tracks.");
				}

			}
		} else {

			// Removevideo stream, by creating a new stream and doing renegotiation. This
			// is the way to go to disable the camera when video is muted.

			if (this.localStream) {
				if (this.videoMute !== m) {
					this.videoMute = m;
					this.doGetUserMediaWithConstraints();
				}
			} else {
				this.videoMute = m;
			}

		}

		return m;

	};

	UserMedia.prototype.addToPeerConnection = function(pc) {

		console.log("Add usermedia stream to peer connection", pc, this.localStream);
		if (this.localStream) {
			pc.addStream(this.localStream);
			var id = pc.id;
			if (!peerconnections.hasOwnProperty(id)) {
				peerconnections[id] = pc;
				pc.currentcall.e.one("closed", function() {
					delete peerconnections[id];
				});
			}
		}

	};

	UserMedia.prototype.removeFromPeerConnection = function(pc) {

		console.log("Remove usermedia stream from peer connection", pc, this.localStream);
		if (this.localStream) {
			pc.removeStream(this.localStream);
			if (peerconnections.hasOwnProperty(pc.id)) {
				delete peerconnections[pc.id];
			}
		}

	};

	UserMedia.prototype.attachMediaStream = function(video) {

		window.attachMediaStream(video, this.localStream);

	};

	return UserMedia;

});
