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
define(['jquery', 'underscore', 'mediastream/peercall'], function($, _, PeerCall) {

	//NOTE(longsleep): This id should be changed to something undeterministic.
	var conferences = 0;

	var PeerConference = function(webrtc, currentcall, id) {

		this.webrtc = webrtc;
		this.currentcall = currentcall;
		this.calls = {};
		this.callsIn = {};

		this.e = $({});

		if (!id) {
			this.id = webrtc.api.id + "_" + (++conferences);
		} else {
			this.id = id;
		}

		this.usermedia = webrtc.usermedia;
		webrtc.e.on("usermedia", _.bind(function(event, um) {
			console.log("Conference user media changed", um);
			this.usermedia = um;
		}, this));

		console.log("Created conference", this.id);

	};

	PeerConference.prototype.createCall = function(id, from, to) {

		var currentcall = new PeerCall(this.webrtc, id, from, to);
		currentcall.e.on("closed", _.bind(function() {
			delete this.calls[id];
			if (this.callsIn.hasOwnProperty(id)) {
				delete this.callsIn[id];
			}
			console.log("Cleaned up conference call", id);
			if (_.isEmpty(this.calls)) {
				console.log("Conference is now empty -> cleaning up.");
				this.e.triggerHandler("finished");
			}
		}, this));
		currentcall.e.on("connectionStateChange", _.bind(function(event, iceConnectionState, currentcall) {
			this.onConnectionStateChange(iceConnectionState, currentcall);
		}, this));
		currentcall.e.on("remoteStreamAdded", _.bind(function(event, stream, currentcall) {
			this.webrtc.onRemoteStreamAdded(stream, currentcall);
		}, this));
		currentcall.e.on("remoteStreamRemoved", _.bind(function(event, stream, currentcall) {
			this.webrtc.onRemoteStreamRemoved(stream, currentcall);
		}, this));

		return currentcall;

	};

	PeerConference.prototype.doCall = function(id, autocall) {

		if (id === this.currentcall.id || this.calls.hasOwnProperty(id)) {
			// Ignore calls which we already have.
			//console.debug("Already got a call to this id (doCall)", id, this.calls, this.currentcall);
			return;
		}

		var call = this.calls[id] = this.createCall(id, null, id);
		call.setInitiate(true);
		call.e.on("sessiondescription", _.bind(function(event, sessionDescription) {
			console.log("Injected conference id into sessionDescription", this.id);
			sessionDescription._conference = this.id;
		}, this));

		if (!autocall) {
			this.webrtc.e.triggerHandler("connecting", [call]);
		}

		console.log("Creating PeerConnection", call);
		call.createPeerConnection(_.bind(function(peerconnection) {
			// Success call.
			if (this.usermedia) {
				this.usermedia.addToPeerConnection(peerconnection);
			}
			call.e.on("negotiationNeeded", _.bind(function(event, extracall) {
				this.webrtc.sendOfferWhenNegotiationNeeded(extracall);
			}, this));
		}, this), _.bind(function() {
			// Error call.
			console.error("Failed to create peer connection for conference call.");
		}, this));

	};

	PeerConference.prototype.handOver = function() {

		// Use a new call as currentcall and return this one.
		var calls = _.keys(this.callsIn);
		if (calls.length) {
			var id = calls[0];
			var currentcall = this.currentcall = this.calls[id];
			delete this.calls[id];
			delete this.callsIn[id];
			console.log("Handed over conference to", id, currentcall);
			if (_.isEmpty(this.calls)) {
				console.log("Conference is now empty -> cleaning up.");
				this.e.triggerHandler("finished");
			}
			return currentcall;
		}
		return null;

	};

	PeerConference.prototype.autoAnswer = function(from, rtcsdp) {

		if (from === this.currentcall.id || this.calls.hasOwnProperty(from)) {
			console.warn("Already got a call to this id (autoAnswer)", from, this.calls);
			return;
		}

		var call = this.calls[from] = this.createCall(from, this.webrtc.api.id, from);
		console.log("Creating PeerConnection", call);
		call.createPeerConnection(_.bind(function(peerconnection) {
			// Success call.
			call.setRemoteDescription(rtcsdp, _.bind(function() {
				if (this.usermedia) {
					this.usermedia.addToPeerConnection(peerconnection);
				}
				call.e.on("negotiationNeeded", _.bind(function(event, extracall) {
					this.webrtc.sendOfferWhenNegotiationNeeded(extracall);
				}, this));
				call.createAnswer(_.bind(function(sessionDescription, extracall) {
					console.log("Sending answer", sessionDescription, extracall.id);
					this.webrtc.api.sendAnswer(extracall.id, sessionDescription);
				}, this));
			}, this));
		}, this), _.bind(function() {
			// Error call.
			console.error("Failed to create peer connection for auto answer.");
		}, this));

	};

	PeerConference.prototype.getCall = function(id) {

		var call = this.calls[id];
		if (!call) {
			call = null;
		}

		return call;

	};

	PeerConference.prototype.close = function() {

		this.currentcall = null;
		var api = this.webrtc.api;
		_.each(this.calls, function(c) {
			c.close();
			var id = c.id;
			if (id) {
				api.sendBye(id);
			}
		});
		this.calls = {};

	};

	PeerConference.prototype.onConnectionStateChange = function(iceConnectionState, currentcall) {

		console.log("Conference peer connection state changed", iceConnectionState, currentcall);
		switch (iceConnectionState) {
			case "completed":
			case "connected":
				if (!this.callsIn.hasOwnProperty(currentcall.id)) {
					this.callsIn[currentcall.id] = true;
					this.pushUpdate();
				}
				break;
			case "failed":
				console.warn("Conference peer connection state failed", currentcall);
				break;
		}
		this.webrtc.onConnectionStateChange(iceConnectionState, currentcall);

	};

	PeerConference.prototype.pushUpdate = function() {

		var calls = _.keys(this.callsIn);
		if (calls) {
			if (this.currentcall) {
				calls.push(this.currentcall.id);
				calls.push(this.webrtc.api.id);
			}
		}
		console.log("Calls in conference: ", calls);
		this.webrtc.api.sendConference(this.id, calls);

	};

	PeerConference.prototype.applyUpdate = function(ids) {

		console.log("Applying conference update", this.id, ids);
		var myid = this.webrtc.api.id;
		_.each(ids, _.bind(function(id) {
			var res = myid < id ? -1 : myid > id ? 1 : 0;
			console.log("Considering conference peers to call", res, id);
			if (res === -1) {
				this.doCall(id, true);
			}
		}, this));

	};

	PeerConference.prototype.peerIds = function() {

		return _.keys(this.calls);

	};

	return PeerConference;

});
