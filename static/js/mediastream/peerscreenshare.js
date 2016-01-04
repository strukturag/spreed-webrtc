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
define(['jquery', 'underscore', 'mediastream/peercall', 'mediastream/tokens'], function($, _, PeerCall, tokens) {

	var screenshareIds = 0;
	var PeerScreenshare;

	// Register ourselves for tokens.
	tokens.registerHandler("screenshare", function(webrtc, id, token, from) {
		console.log("Creating new screenshare for incoming offer from", from, id);
		var peerscreenshare = new PeerScreenshare(webrtc, id, token, from);
		return peerscreenshare;
	});

	// PeerScreenshare inherits from PeerCall.
	PeerScreenshare = function(webrtc, id, token, to) {

		if (id === null) {
			id = screenshareIds++;
		}

		// Call super.
		PeerCall.call(this, webrtc, id, null, to);

		// Set stuff.
		this.token = token;
		this.messageHandler = null;

		// We only receive, and never send.
		this.mediaConstraints = {
			audio: false,
			video: false
		}
		// SCTP is supported from Chrome M31.
		// No need to pass DTLS constraint as it is on by default in Chrome M31.
		// For SCTP, reliable and ordered is true by default.
		this.pcConstraints = {
			mandatory: {},
			optional: []
		};
		this.offerOptions.offerToReceiveAudio = false;
		this.offerOptions.offerToReceiveVideo = true;

		// Inject token into sessiondescription and ice candidate data.
		this.e.on("sessiondescription icecandidate", _.bind(function(event, data) {
			data._token = this.token;
			data._id = this.id;
		}, this));

	};

	// Static function.
	PeerScreenshare.getCaptureMediaConstraints = function(webrtc, options) {

		var screenWidth = window.screen.width;
		var screenHeight = window.screen.height;

		// Constraints which define what actually gets shared need to
		// be provided in options.
		var mandatoryVideoConstraints = $.extend(true, {}, {
			maxWidth: screenWidth,
			maxHeight: screenHeight,
			minWidth: 1,
			minHeight: 1
		}, webrtc.settings.screensharing.mediaConstraints.video.mandatory, options);
		var mediaConstraints = $.extend(true, {}, webrtc.settings.screensharing.mediaConstraints, {
			audio: false
		});
		mediaConstraints.video.mandatory = mandatoryVideoConstraints;
		console.log("Setting screen sharing media constraints", mediaConstraints);
		return mediaConstraints;

	};

	// Inherit from PeerCall.
	PeerScreenshare.prototype = Object.create(PeerCall.prototype);
	PeerScreenshare.prototype.constructor = PeerScreenshare;

	PeerScreenshare.prototype.close = function() {
		PeerCall.prototype.close.call(this);
	};

	PeerScreenshare.prototype.onMessage = function(event) {
		// Our own datachannel event.
		//console.log("Xfer datachannel event", [event.data], event, this);
		if (this.messageHandler) {
			this.messageHandler(event.data, this);
		} else {
			console.warn("No messageHandler for message", event, this);
		}
	};

	PeerScreenshare.prototype.send = function(data) {
		if (!this.peerconnection) {
			console.warn("Screenshare cannot send because not connected.");
			return;
		}
		return this.peerconnection.send(data);
	};

	return PeerScreenshare;

});
