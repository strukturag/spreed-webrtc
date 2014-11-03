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
define(['jquery', 'underscore', 'webrtc.adapter'], function($, _) {

	var count = 0;
	var dataChannelDefaultLabel = "default";

	var PeerConnection = function(webrtc, currentcall) {

		this.webrtc = webrtc;
		this.id = count++;
		this.currentcall = null;
		this.pc = null;
		this.datachannel = null;
		this.datachannelReady = false;

		if (currentcall) {
			this.createPeerConnection(currentcall);
		}

	}

	PeerConnection.prototype.createPeerConnection = function(currentcall) {

		// XXX(longsleep): This function is a mess.

		var pc;
		if (currentcall) {
			this.currentcall = currentcall;
		} else {
			currentcall = this.currentcall;
		}

		try {
			// Create an RTCPeerConnection via the polyfill (adapter.js)
			console.log('Creating RTCPeerConnnection with:\n' +
				'  config: \'' + JSON.stringify(currentcall.pcConfig) + '\';\n' +
				'  constraints: \'' + JSON.stringify(currentcall.pcConstraints) + '\'.');
			pc = this.pc = new RTCPeerConnection(currentcall.pcConfig, currentcall.pcConstraints);
		} catch (e) {
			console.error('Failed to create PeerConnection, exception: ' + e.message);
			pc = this.pc = null;
		}

		if (pc) {

			// Bind peer connection events.
			pc.onicecandidate = _.bind(currentcall.onIceCandidate, currentcall);
			pc.oniceconnectionstatechange = _.bind(this.onIceConnectionStateChange, this)
			// NOTE(longsleep): There are several szenarios where onaddstream is never fired, when
			// the peer does not provide a certain stream type (eg. has no camera). See
			// for example https://bugzilla.mozilla.org/show_bug.cgi?id=998546.
			pc.onaddstream = _.bind(this.onRemoteStreamAdded, this);
			pc.onremovestream = _.bind(this.onRemoteStreamRemoved, this);
			pc.onnegotiationneeded = _.bind(this.onNegotiationNeeded, this);
			pc.ondatachannel = _.bind(this.onDatachannel, this);
			pc.onsignalingstatechange = function(event) {
				// XXX(longsleep): Remove this or handle it in a real function.
				// XXX(longsleep): Firefox 25 does send event as a string (like stable).
				console.debug("Signaling state changed", pc.signalingState);
			};
			// NOTE(longsleep):
			// Support old callback too (https://groups.google.com/forum/?fromgroups=#!topic/discuss-webrtc/glukq0OWwVM)
			// Chrome < 27 and Firefox < 24 need this.
			pc.onicechange = _.bind(function(iceConnectionState) {
				//XXX(longsleep): Hack the compatibility to new style event.
				console.warn("Old style onicechange event", arguments);
				this.onIceConnectionStateChange({
					target: {
						iceConnectionState: iceConnectionState
					}
				});
			}, this);

			// Create default data channel when we are in initiate mode.
			if (currentcall.initiate) {
				if (webrtcDetectedBrowser !== "chrome" || !webrtcDetectedAndroid || (webrtcDetectedBrowser === "chrome" && webrtcDetectedVersion >= 33)) {
					// NOTE(longsleep): Android (Chrome 32) does have broken SCTP data channels
					// which makes connection fail because of sdp set error for answer/offer.
					// See https://code.google.com/p/webrtc/issues/detail?id=2253 Lets hope the
					// crap gets fixed with Chrome on Android 33. For now disable SCTP in flags
					// on Adroid to be able to accept offers with SCTP in it.
					// chrome://flags/#disable-sctp-data-channels
					this.createDatachannel(dataChannelDefaultLabel, {
						ordered: true
					});
				}
			}

		}

		return pc;

	};

	PeerConnection.prototype.createDatachannel = function(label, init) {

		if (!label) {
			console.error("Refusing to create a datachannel without a label.", label, init);
			return;
		}

		var rtcinit = $.extend({}, init);
		console.debug("Creating datachannel:", label, rtcinit, this);

		// Create datachannel.
		var datachannel;
		try {
			datachannel = this.pc.createDataChannel(label, rtcinit);
			// Fake onDatachannel event.
			this.onDatachannel({
				channel: datachannel
			});
		} catch (e) {
			console.error('Failed to create DataChannel, exception: ' + e.message);
			if (label === dataChannelDefaultLabel) {
				this.datachannel = null;
				this.datachannelReady = false;
			}
		}
		return datachannel;

	};

	PeerConnection.prototype.onDatachannel = function(event) {

		var datachannel = event.channel;
		if (datachannel) {
			if (datachannel.label === dataChannelDefaultLabel) {
				datachannel.binaryType = "arraybuffer";
				// We handle the default data channel ourselves.
				console.debug("Got default datachannel", datachannel.label, this.id, datachannel, this);
				this.datachannel = datachannel;
				var eventHandler = _.bind(this.currentcall.onDatachannelDefault, this.currentcall);
				// Bind datachannel events and settings.
				datachannel.onmessage = _.bind(this.currentcall.onMessage, this.currentcall);
				datachannel.onopen = _.bind(function(event) {
					console.log("Datachannel opened", datachannel.label, this.id, event);
					this.datachannelReady = true;
					eventHandler("open", datachannel);
				}, this);
				datachannel.onclose = _.bind(function(event) {
					console.log("Datachannel closed", datachannel.label, this.id, event);
					this.datachannelReady = false;
					eventHandler("close", datachannel);
				}, this);
				datachannel.onerror = _.bind(function(event) {
					console.warn("Datachannel error", datachannel.label, this.id, event);
					this.datachannelReady = false;
					eventHandler("error", datachannel);
				}, this);
			} else {
				// Delegate.
				console.debug("Got datachannel", datachannel.label, this.id, datachannel);
				_.defer(_.bind(this.currentcall.onDatachannel, this.currentcall), datachannel);
			}
		}

	};

	PeerConnection.prototype.send = function(data) {

		if (!this.datachannelReady) {
			console.error("Unable to send message by datachannel because datachannel is not ready.", data);
			return;
		}
		if (data instanceof Blob) {
			this.datachannel.send(data);
		} else if (data instanceof ArrayBuffer) {
			this.datachannel.send(data);
		} else {
			try {
				this.datachannel.send(JSON.stringify(data));
			} catch (e) {
				console.warn("Data channel failed to send string -> closing.", e);
				this.datachannelReady = false;
				this.datachannel.close();
			}
		}

	};

	PeerConnection.prototype.onIceConnectionStateChange = function(event) {

		var iceConnectionState = event.target.iceConnectionState;
		console.info("ICE connection state change", iceConnectionState, event, this.currentcall);
		this.currentcall.onIceConnectionStateChange(iceConnectionState);

	};

	PeerConnection.prototype.onRemoteStreamAdded = function(event) {

		var stream = event.stream;
		console.info('Remote stream added.', stream);
		this.currentcall.onRemoteStreamAdded(stream);

	};

	PeerConnection.prototype.onRemoteStreamRemoved = function(event) {

		var stream = event.stream;
		console.info('Remote stream removed.', stream);
		this.currentcall.onRemoteStreamRemoved(stream);

	};

	PeerConnection.prototype.onNegotiationNeeded = function(event) {

		// XXX(longsleep): Renegotiation seems to break video streams on Chrome 31.
		// XXX(longsleep): Renegotiation can happen from both sides, meaning this
		// could switch offer/answer side - oh crap.
		var peerconnection = event.target;
		if (peerconnection === this.pc) {
			//console.log("Negotiation needed.", peerconnection.remoteDescription, peerconnection.iceConnectionState, peerconnection.signalingState, this);
			this.currentcall.onNegotiationNeeded(this);
		}

	};

	PeerConnection.prototype.close = function() {

		if (this.datachannel) {
			this.datachannel.close()
		}
		if (this.pc) {
			this.pc.close();
		}

		this.currentcall.onRemoteStreamRemoved(null);

		this.datachannel = null;
		this.pc = null;

	};

	PeerConnection.prototype.setRemoteDescription = function() {

		return this.pc.setRemoteDescription.apply(this.pc, arguments);

	};

	PeerConnection.prototype.setLocalDescription = function() {

		return this.pc.setLocalDescription.apply(this.pc, arguments);

	};

	PeerConnection.prototype.addIceCandidate = function() {

		return this.pc.addIceCandidate.apply(this.pc, arguments);

	};

	PeerConnection.prototype.addStream = function() {

		return this.pc.addStream.apply(this.pc, arguments);

	};

	PeerConnection.prototype.removeStream = function() {

		return this.pc.removeStream.apply(this.pc, arguments);

	};

	PeerConnection.prototype.createAnswer = function() {

		return this.pc.createAnswer.apply(this.pc, arguments);

	};

	PeerConnection.prototype.createOffer = function() {

		return this.pc.createOffer.apply(this.pc, arguments);

	};

	PeerConnection.prototype.getRemoteStreams = function() {

		return this.pc.getRemoteStreams.apply(this.pc, arguments);

	};

	PeerConnection.prototype.getLocalStreams = function() {

		return this.pc.getRemoteStreams.apply(this.pc, arguments);

	};

	PeerConnection.prototype.getStreamById = function() {

		return this.pc.getStreamById.apply(this.pc, arguments);

	};

	return PeerConnection;

});
