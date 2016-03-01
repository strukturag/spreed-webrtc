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
define(['jquery', 'underscore', 'audiocontext', 'mediastream/dummystream', 'webrtc.adapter'], function($, _, AudioContext, DummyStream) {

	// Create AudioContext singleton, if supported.
	var context = AudioContext ? new AudioContext() : null;

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
		return c;
	};
	// Adapter to support navigator.mediaDevices API.
	// http://w3c.github.io/mediacapture-main/getusermedia.html#mediadevices
	var getUserMedia = (function() {
		if (window.webrtcDetectedBrowser === "firefox"&& window.webrtcDetectedVersion >= 38) {
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

	var stopUserMediaStream = (function() {
		return function(stream) {
			if (stream && stream.getTracks) {
				// Stop all tracks.
				var tracks = stream.getTracks();
				_.each(tracks, function(t) {
					t.stop();
				});
				if (window.webrtcDetectedBrowser === "firefox" && window.webrtcDetectedVersion < 44) {
					// Always call stop for older Firefox < 44 to make sure gUM is correctly cleaned up.
					// https://bugzilla.mozilla.org/show_bug.cgi?id=1192170
					if (stream.stop) {
						stream.stop();
					}
				}
			} else {
				// MediaStream.stop is deprecated.
				stream.stop();
			}
		}
	})();

	// UserMedia.
	var UserMedia = function(options) {

		this.options = $.extend({}, options);
		this.e = $({}); // Events.

		this.localStream = null;
		this.started = false;

		this.peerconnections = {};

		// If true, mute/unmute of audio/video creates a new stream which
		// will trigger renegotiation on the peer connection.
		this.renegotiation = options.renegotiation && true;
		if (this.renegotiation) {
			console.info("User media with renegotiation created ...");
		}

		this.audioMute = options.audioMute && true;
		this.videoMute = options.videoMute && true;
		this.mediaConstraints = null;

		// Audio level.
		this.audioLevel = 0;
		if (!this.options.noAudio && context && context.createScriptProcessor) {

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
					var audioTracks = stream.getAudioTracks();
					if (audioTracks.length < 1) {
						this.audioSource = null;
						return;
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
				_.each(this.peerconnections, function(pc) {
					if (DummyStream.not(oldstream)) {
						pc.removeStream(oldstream);
					}
					if (DummyStream.not(stream)) {
						pc.addStream(stream);
					}
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
				stopUserMediaStream(stream);
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
	UserMedia.getUserMedia = getUserMedia;
	UserMedia.stopUserMediaStream = stopUserMediaStream;

	UserMedia.prototype.doGetUserMedia = function(currentcall, mediaConstraints) {

		if (!mediaConstraints) {
			mediaConstraints = currentcall.mediaConstraints;
		}

		return this.doGetUserMediaWithConstraints(mediaConstraints);

	};

	UserMedia.prototype.doGetUserMediaWithConstraints = function(mediaConstraints) {

		if (!mediaConstraints) {
			mediaConstraints = this.mediaConstraints;
		} else {
			this.mediaConstraints = mediaConstraints;
			if (this.localStream) {
				// Release stream early if any to be able to apply new constraints.
				this.replaceStream(null);
			}
		}

		var constraints = $.extend(true, {}, mediaConstraints);

		if (this.renegotiation) {

			if (this.audioMute && this.videoMute) {
				// Fast path as nothing should be shared.
				_.defer(_.bind(function() {
					this.onUserMediaSuccess(new DummyStream());
				}, this));
				this.started = true;
				return true
			}

			if (this.audioMute) {
				constraints.audio = false;
			}
			if (this.videoMute) {
				constraints.video = false;
			}

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
			stopUserMediaStream(stream);
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

	UserMedia.prototype.replaceStream = function(stream) {

		var oldStream = this.localStream;

		if (oldStream && oldStream.active) {
			// Let old stream silently end.
			var onendedsilent = function(event) {
				console.log("Silently ended replaced user media stream.");
			};
			if (oldStream.getTracks) {
				_.each(stream.getTracks(), function(t) {
					t.onended = onendedsilent;
				});
			} else {
				// Legacy api.
				oldStream.onended = onendedsilent;
			}
			stopUserMediaStream(oldStream);
		}

		if (stream) {
			// Catch events when streams end.
			var trackCount = 0;
			var onended = _.bind(function(event) {
				trackCount--;
				if (this.started && trackCount <= 0) {
					console.log("Stopping user media as a stream has ended.", event);
					this.stop();
				}
			}, this);
			if (stream.getTracks) {
				_.each(stream.getTracks(), function(t) {
					t.onended = onended;
					trackCount++;
				});
			} else {
				// Legacy api.
				stream.onended = onended;
				trackCount++;
			}
			// Set new stream.
			this.localStream = stream;
			this.e.triggerHandler("localstream", [stream, oldStream, this]);
		}

		return oldStream && stream;

	};

	UserMedia.prototype.onLocalStream = function(stream) {

		if (this.replaceStream(stream)) {
			// We replaced a stream.
			setTimeout(_.bind(function() {
				this.e.triggerHandler("mediachanged", [this]);
			}, this), 0);
		} else {
			// We are new.
			setTimeout(_.bind(function() {
				this.e.triggerHandler("mediasuccess", [this]);
			}, this), 0);
		}

		if (!this.renegotiation) {
			// Apply mute states after we got streams.
			this.applyAudioMute(this.audioMute);
			this.applyVideoMute(this.videoMute);
		}

	};

	UserMedia.prototype.stop = function() {

		this.started = false;

		if (this.audioSource) {
			this.audioSource.disconnect();
			this.audioSource = null;
		}
		if (this.localStream) {
			stopUserMediaStream(this.localStream);
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
		this.e.off();

	};

	UserMedia.prototype.applyAudioMute = function(mute) {

		var m = !!mute;

		if (!this.renegotiation) {

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

			if (this.started) {
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

		if (!this.renegotiation) {

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

			// Remove video stream, by creating a new stream and doing renegotiation. This
			// is the way to go to disable the camera when video is muted.

			if (this.started) {
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
			if (DummyStream.not(this.localStream)) {
				pc.addStream(this.localStream);
			}
			var id = pc.id;
			if (!this.peerconnections.hasOwnProperty(id)) {
				this.peerconnections[id] = pc;
				pc.currentcall.e.one("closed", _.bind(function() {
					delete this.peerconnections[id];
				}, this));
			}
		} else {
			// Make sure to trigger renegotiation even if we have no media.
			_.defer(pc.negotiationNeeded);
		}

	};

	UserMedia.prototype.removeFromPeerConnection = function(pc) {

		console.log("Remove usermedia stream from peer connection", pc, this.localStream);
		if (this.localStream) {
			if (DummyStream.not(this.localStream)) {
				pc.removeStream(this.localStream);
			}
			if (this.peerconnections.hasOwnProperty(pc.id)) {
				delete this.peerconnections[pc.id];
			}
		}

	};

	UserMedia.prototype.attachMediaStream = function(video) {

		if (this.localStream && DummyStream.not(this.localStream)) {
			window.attachMediaStream(video, this.localStream);
		}

	};

	return UserMedia;

});
