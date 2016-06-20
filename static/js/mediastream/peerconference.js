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

	var conferences = 0;

	var STATE_ACTIVE = "active";
	var STATE_INCOMING = "incoming";
	var STATE_OUTGOING = "outgoing";

	var PeerConference = function(webrtc) {

		this.webrtc = webrtc;

		this.calls = {};
		this.callsCount = 0;
		this.callStates = {};
		this.connectedCalls = {};
		// Ids of calls that "seem" to be disconnected (i.e. had a p2p state
		// change of "disconnected" without a "Bye").
		this.disconnectedCalls = {};
		this.conferenceMode = false;

		this.e = $({});
		this.id = null;

		// Send conference updates to the other peers once we get a new connection.
		webrtc.e.on("statechange", _.bind(function(event, iceConnectionState, currentcall) {
			this.onConnectionStateChange(iceConnectionState, currentcall);
		}, this));
	};

	// Creates a new unique random id to be used as conference id.
	PeerConference.prototype._createConferenceId = function() {
		return this.webrtc.api.id + "_" + (++conferences) + "_" + Math.round(Math.random() * 1e16);
	};

	PeerConference.prototype.getOrCreateId = function() {
		if (!this.id) {
			this.id = this._createConferenceId();
			console.log("Created new conference id", this.id);
		}
		return this.id;
	};

	PeerConference.prototype.hasCalls = function() {
		return this.callsCount > 0;
	};

	// Return number of currently active and pending calls.
	PeerConference.prototype.getCallsCount = function() {
		return this.callsCount;
	};

	PeerConference.prototype._addCallWithState = function(id, call, state) {
		var oldcall = this.calls[id];
		if (oldcall) {
			if (!this.disconnectedCalls[id]) {
				console.warn("Already has a call for", id);
				return false;
			}
			oldcall.close();  // This will remove the call from the conference.
		}

		this.calls[id] = call;
		this.callStates[id] = state;
		this.callsCount += 1;
		return true;
	};

	PeerConference.prototype.addIncoming = function(from, call) {
		return this._addCallWithState(from, call, STATE_INCOMING);
	};

	PeerConference.prototype.addOutgoing = function(to, call) {
		return this._addCallWithState(to, call, STATE_OUTGOING);
	};

	PeerConference.prototype._setCallState = function(id, state) {
		if (this.callStates.hasOwnProperty(id)) {
			this.callStates[id] = state;
			console.log("Call state changed", id, state);
		}
	};

	PeerConference.prototype.setCallActive = function(id) {
		this._setCallState(id, STATE_ACTIVE);
	};

	PeerConference.prototype.getCall = function(id) {
		if (this.disconnectedCalls[id]) {
			return null;
		}
		return this.calls[id] || null;
	};

	PeerConference.prototype.getCalls = function() {
		return _.values(this.calls);
	};

	PeerConference.prototype.getCallIds = function() {
		return _.keys(this.calls);
	};

	PeerConference.prototype.removeCall = function(id) {
		if (!this.calls.hasOwnProperty(id)) {
			return null;
		}

		var call = this.calls[id];
		delete this.calls[id];
		delete this.callStates[id];
		delete this.connectedCalls[id];
		delete this.disconnectedCalls[id];
		this.callsCount -= 1;
		return call;
	};

	PeerConference.prototype.markDisconnected = function(id) {
		this.disconnectedCalls[id] = true;
	};

	PeerConference.prototype.isDisconnected = function(id) {
		return this.disconnectedCalls[id] || false;
	};

	PeerConference.prototype.getDisconnectedIds = function(id) {
		return _.keys(this.disconnectedCalls);
	};

	PeerConference.prototype.close = function() {

		var api = this.webrtc.api;
		_.each(this.calls, function(c) {
			c.close();
			var id = c.id;
			if (id) {
				api.sendBye(id);
			}
		});
		this.calls = {};
		this.callStates = {};
		this.connectedCalls = {};
		this.callsCount = 0;
		this.id = null;

	};

	PeerConference.prototype.onConnectionStateChange = function(iceConnectionState, currentcall) {

		console.log("Conference peer connection state changed", iceConnectionState, currentcall);
		switch (iceConnectionState) {
			case "completed":
			case "connected":
				if (!this.connectedCalls.hasOwnProperty(currentcall.id)) {
					this.connectedCalls[currentcall.id] = true;
					this.pushUpdate();
				}
				break;
			case "failed":
				console.warn("Conference peer connection state failed", currentcall);
				break;
		}

	};

	PeerConference.prototype.pushUpdate = function(forceAll) {
		if (this.webrtc.isConferenceRoom()) {
			// Conference is managed on the server.
			return;
		}

		var ids = _.keys(this.connectedCalls);
		if (forceAll) {
			// Include "disconnected" calls to try to recover from a previous
			// lost connection.
			ids = _.union(ids, this.getDisconnectedIds());
		}
		if (ids.length > 1) {
			ids.push(this.webrtc.api.id);
			console.log("Calls in conference:", ids);
			this.webrtc.api.sendConference(this.getOrCreateId(), ids);
		}
	};

	PeerConference.prototype.peerIds = function() {
		return this.getCallIds();
	};

	return PeerConference;

});
