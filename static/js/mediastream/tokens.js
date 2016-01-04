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
define(['jquery', 'underscore'], function($, _) {

	var tokens;

	var Token = function(handlerKey) {
		this.e = $({});
		this.count = 0;
		this.trigger = null;
		this.handlers = {};
		this.handlerKey = handlerKey;
	};

	Token.prototype.on = function(name, f) {
		this.count++;
		return this.e.on(name, f);
	};

	Token.prototype.off = function(name, f, nodecrement) {
		this.e.off(name, f);
		if (!nodecrement) {
			this.count--;
		}
	};

	Token.prototype.addHandler = function(handler, namespace, subid) {
		if (!subid) {
			subid = handler.id;
		}
		this.handlers[tokens.makeId(namespace, subid)] = handler;
		return handler;
	};

	Token.prototype.getHandler = function(id) {
		return this.handlers[id];
	}


	var Tokens = function() {
		this.tokens = {};
		this.handlers = {};
		this.e = $({});
	};

	Tokens.prototype.registerHandler = function(name, f) {
		this.handlers[name] = f;
	};

	Tokens.prototype.makeId = function() {
		var args = Array.prototype.slice.call(arguments);
		return args.join("_");
	};

	Tokens.prototype.valid = function(token) {
		return this.tokens.hasOwnProperty(token);
	};

	Tokens.prototype.get = function(token) {
		return this.tokens[token];
	};

	Tokens.prototype.bind = function(name, token, f, handlerKey) {
		// f is triggered on message event, cf is trigger on create calls.
		var obj = this.tokens[token];
		if (!obj) {
			obj = this.tokens[token] = new Token(handlerKey);
			console.log("Created token", token, obj);
		}
		return obj.on(name, f);
	};

	Tokens.prototype.on = function(token, f, handlerKey) {
		return this.bind("message", token, f, handlerKey);
	};

	Tokens.prototype.create = function(token, f, handlerKey) {
		return this.bind("created", token, f, handlerKey);
	};

	Tokens.prototype.off = function(token, f) {
		var obj = this.tokens[token];
		if (obj) {
			// NOTE(longsleep): No way to know which, kill both.
			obj.off("message", f);
			obj.off("created", f, true);
			if (obj.count <= 0) {
				delete this.tokens[token];
				console.log("Removed token", token, obj);
			}
		}
	};

	Tokens.prototype.processReceivedMessage = function(webrtc, token, id, to, data, type, to2, from) {

		if (!this.valid(token)) {
			console.warn("Received token request for unknown token -> ignore.", token);
			return;
		}

		// Per default events trigger on the registered objects.
		var obj = this.get(token);

		// Create dynamic trigger function on first request.
		if (obj && !obj.trigger) {
			obj.trigger = (function(webrtc, token, to, to2, from) {
				return _.bind(function(data, currentconn) {
					//console.log("Processing token channel message", data);
					this.e.triggerHandler("message", [token, to, data, null, to2, from, currentconn]);
				}, obj);
			}(webrtc, token, to, to2, from));
		}

		// Lookup existing handler connection.
		var handler = obj.getHandler(this.makeId(from, id));

		switch (type) {
			case "Offer":
				if (!handler) {
					var creator = this.handlers[obj.handlerKey];
					if (!creator) {
						console.warn("Incoming offer for unknown handler", obj.handlerKey);
						return;
					}
					// Create new handler based on type.
					handler = creator(webrtc, id, token, from);
					obj.addHandler(handler, from, id);
					handler.createPeerConnection(function() {
						obj.e.triggerHandler("created", [token, to, data, type, to2, from, handler]);
					});
					// Set message implementation.
					handler.messageHandler = _.bind(obj.trigger, obj);
				}
				handler.setRemoteDescription(new window.RTCSessionDescription(data), _.bind(function() {
					handler.createAnswer(_.bind(function(sessionDescription, currenthandler) {
						//console.log("Sending handler answer", sessionDescription, currenthandler.id);
						webrtc.api.sendAnswer(from, sessionDescription);
					}, this));
				}, this));
				break;
			case "Answer":
				console.log("Token answer process.");
				if (!handler.messageHandler) {
					handler.messageHandler = _.bind(obj.trigger, obj);
				}
				handler.setRemoteDescription(new window.RTCSessionDescription(data));
				break;
			case "Candidate":
				var candidate = new window.RTCIceCandidate({
					sdpMLineIndex: data.sdpMLineIndex,
					sdpMid: data.sdpMid,
					candidate: data.candidate
				});
				handler.addIceCandidate(candidate);
				break;
			default:
				//console.log("Processing token message", type, token);
				obj.e.triggerHandler("message", [token, to, data, type, to2, from, handler]);
				break;
		}

	};

	tokens = new Tokens();
	return tokens;

});
