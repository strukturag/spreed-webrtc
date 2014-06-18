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
define(['jquery', 'underscore'], function($, _) {

	var alive_check_timeout = 5000;
	var alive_check_timeout_2 = 10000;

	var Api = function(connector) {

		this.id = null;
		this.sid = null;
		this.session = {};
		this.connector = connector;
		this.iids= 0;

		this.e = $({});

		connector.e.on("received", _.bind(function(event, data) {
			this.received(data);
		}, this));

		// Trigger alive heartbeat when nothing is received for a while.
		this.heartbeat = window.setInterval(_.bind(function() {
			var last_receive = this.last_receive;
			if (this.connector.connected) {
				if (last_receive !== null) {
					//console.log("api heartbeat", this.last_receive);
					var now = new Date().getTime();
					if (this.last_receive_overdue) {
						if (now > last_receive + alive_check_timeout_2) {
							console.log("Reconnecting because alive timeout was reached.");
							this.last_receive_overdue = false;
							this.last_receive = null;
							this.connector.reconnect();
						}
					} else {
						if (now > last_receive + alive_check_timeout) {
							//console.log("overdue 1");
							this.last_receive_overdue = true;
							this.sendAlive(now);
						}
					}
				}
			} else {
				this.last_receive = null;
				this.last_receive_overdue = false;
			}
		}, this), 1000);
		this.last_receive = null;
		this.last_receive_overdue = false;

	};

	Api.prototype.send = function(type, data, noqueue) {

		var payload = {
			Type: type
		};
		payload[type] = data;
		//console.log("<<<<<<<<<<<<", JSON.stringify(payload, null, 2));
		this.connector.send(payload, noqueue);

	};

	Api.prototype.send2 = function(name, cb) {
		var obj = {
			send: _.bind(function(type, data) {
				if (cb) {
					cb(type, data);
				}
				this.send(type, data);
			}, this)
		}
		return this.apply(name, obj);
	};

	Api.prototype.request = function(type, data, cb) {

		var payload = {
			Type: type
		}
		payload[type] = data;
		if (cb) {
			var iid = ""+(this.iids++);
			payload.Iid = iid;
			this.e.one(iid+".request", cb);
		}
		this.connector.send(payload);

	}

	// Helper hack function to send API requests to other destinations.
	// Simply provide an alternative send function on the obj Object.
	Api.prototype.apply = function(name, obj) {
		var f = this[name];
		return _.bind(f, obj);
	};

	Api.prototype.received = function(d) {

		// Store received timestamp.
		var now = new Date().getTime();
		this.last_receive = now;
		this.last_receive_overdue = false;

		var iid = d.Iid;
		var data = d.Data;
		var dataType = data.Type;

		if (iid) {
			// Shortcut for iid registered responses.
			this.e.triggerHandler(iid+".request", [dataType, data]);
			return;
		}

		switch (dataType) {
			case "Self":
				console.log("Self received", data);
				if (data.Token) {
					this.connector.token = data.Token;
				}
				this.id = data.Id;
				this.sid = data.Sid;
				this.e.triggerHandler("received.self", [data]);
				break;
			case "Offer":
				console.log("Offer received", data.To, data.Offer);
				this.e.triggerHandler("received.offer", [data.To, data.Offer, data.Type, d.To, d.From]);
				break;
			case "Candidate":
				//console.log("Candidate received", data.To, data.Candidate);
				this.e.triggerHandler("received.candidate", [data.To, data.Candidate, data.Type, d.To, d.From]);
				break;
			case "Answer":
				console.log("Answer received", data.To, data.Answer);
				this.e.triggerHandler("received.answer", [data.To, data.Answer, data.Type, d.To, d.From]);
				break;
			case "Users":
				console.log("Connected users: " + data.Users.length);
				this.e.triggerHandler("received.users", [data.Users]);
				break;
			case "Bye":
				console.log("Bye received", data.To, data.Bye);
				this.e.triggerHandler("received.bye", [data.To, data.Bye, data.Type, d.To, d.From]);
				break;
			case "Joined":
			case "Left":
				//console.log("User action received", dataType, data);
				this.e.triggerHandler("received.userleftorjoined", [dataType, data]);
				break;
			case "Status":
				//console.log("User status received", dataType, data);
				this.e.triggerHandler("received.status", [data]);
				break;
			case "Chat":
				//console.log("chat received", dataType, data);
				this.e.triggerHandler("received.chat", [data.To, d.From, data.Chat, d.p2p]);
				break;
			case "Conference":
				this.e.triggerHandler("received.conference", [data.Id, data.Conference, data.Type, d.To, d.From]);
				break;
			case "Talking":
				this.e.triggerHandler("received.talking", [d.To, d.From, data.Talking]);
				break;
			case "Screenshare":
				this.e.triggerHandler("received.screenshare", [d.To, d.From, data.Screenshare, d.p2p]);
				break;
			case "Alive":
				// Do nothing.
				//console.log("Alive response received.");
				break;
			default:
				console.log("Unhandled type received:", dataType, data);
				break;
		}

	};

	Api.prototype.sendSelf = function() {

		var data = {
			Type: "Self",
			Self: {}
		}

		return this.send("Self", data, true);

	};

	Api.prototype.sendOffer = function(to, payload) {

		var data = {
			To: to,
			Type: "Offer",
			Offer: payload
		}

		return this.send("Offer", data);

	};

	Api.prototype.sendCandidate = function(to, payload) {

		var data = {
			To: to,
			Type: "Candidate",
			Candidate: payload
		}

		return this.send("Candidate", data);

	}

	Api.prototype.sendAnswer = function(to, payload) {

		var data = {
			To: to,
			Type: "Answer",
			Answer: payload
		}

		return this.send("Answer", data);

	}

	Api.prototype.requestUsers = function() {

		var data = {
			Type: "Users",
			Users: {}
		}

		return this.send("Users", data);

	};

	Api.prototype.requestAuthentication = function(userid, nonce) {

		var data = {
			Type: "Authentication",
			Authentication: {
				Userid: userid,
				Nonce: nonce
			}
		}

		return this.send("Authentication", data);

	};

	Api.prototype.updateStatus = function(status) {

		var data = {
			Type: "Status",
			Status: status
		}

		return this.send("Status", data);

	};

	Api.prototype.sendBye = function(to, reason) {

		var data = {
			To: to,
			Type: "Bye",
			Bye: {
				Reason: reason
			}
		}

		return this.send("Bye", data);

	};

	Api.prototype.sendChat = function(to, message, status, mid) {

		var data = {
			To: to,
			Type: "Chat",
			Chat: {
				Mid: mid,
				Message: message,
				Status: status,
				NoEcho: true // This client shows own messages internally.
			}
		}

		return this.send("Chat", data);

	};

	Api.prototype.sendConference = function(id, ids) {

		var data = {
			Id: id,
			Type: "Conference",
			Conference: ids
		}

		return this.send("Conference", data);

	};

	Api.prototype.sendScreenshare = function(id, screen_id) {

		var data = {
			Id: id,
			Type: "Screenshare",
			Screenshare: {
				id: screen_id
			}
		}

		return this.send("Screenshare", data);

	};

	Api.prototype.sendAlive = function(timestamp) {

		var data = {
			Type: "Alive",
			Alive: timestamp
		}

		return this.send("Alive", data);
	};

	Api.prototype.sendSessions = function(token, type, cb) {

		var data = {
			Type: "Sessions",
			Sessions: {
				Type: type,
				Token: token
			}
		}

		return this.request("Sessions", data, cb);

	};

	return Api;

});
