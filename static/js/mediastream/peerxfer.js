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
define(['jquery', 'underscore', 'mediastream/peercall', 'mediastream/tokens', 'webrtc.adapter'], function($, _, PeerCall, tokens) {

	var xfersIds = 0;
	var PeerXfer;

	// Register ourselves for tokens.
	tokens.registerHandler("xfer", function(webrtc, id, token, from) {
		console.log("Creating new xfer for incoming offer from", from, id);
		var xfer = new PeerXfer(webrtc, id, token, from);
		return xfer;
	});

	// PeerXfer inherits from PeerCall.
	PeerXfer = function(webrtc, id, token, to) {

		if (id === null) {
			id = xfersIds++;
		}

		// Call super.
		PeerCall.call(this, webrtc, id, null, to);

		// Set stuff.
		this.token = token;
		this.messageHandler = null;
		this.mediaConstraints = {
			audio: false,
			video: false
		};
		// SCTP is supported from Chrome M31.
		// No need to pass DTLS constraint as it is on by default in Chrome M31.
		// For SCTP, reliable and ordered is true by default.
		this.pcConstraints = {
			mandatory: {},
			optional: []
		};
		this.offerOptions = {};

		// Inject token into sessiondescription and ice candidate data.
		this.e.on("sessiondescription icecandidate", _.bind(function(event, data) {
			data._token = this.token;
			data._id = this.id;
		}, this));

	};

	// Inherit from PeerCall.
	PeerXfer.prototype = Object.create(PeerCall.prototype);
	PeerXfer.prototype.constructor = PeerXfer;

	PeerXfer.prototype.close = function() {
		PeerCall.prototype.close.call(this);
	};

	PeerXfer.prototype.cancel = function() {
		this.e.triggerHandler("cancel", [this]);
		this.close();
	};

	PeerXfer.prototype.onMessage = function(event) {
		// Our own datachannel event.
		//console.log("Xfer datachannel event", [event.data], event, this);
		if (this.messageHandler) {
			this.messageHandler(event.data, this);
		} else {
			console.warn("No messageHandler for message", event, this);
		}
	};

	PeerXfer.prototype.send = function(data) {
		if (!this.peerconnection) {
			console.warn("Xfer cannot send because not connected.");
			return;
		}
		return this.peerconnection.send(data);
	};

	return PeerXfer;

});
