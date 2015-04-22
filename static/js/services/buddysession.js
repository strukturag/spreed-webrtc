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
define(["underscore"], function(_) {

	// buddySession
	return [function() {

		var sessions = {};
		var serials = 0;

		var BuddySession = function(data) {
			this.serial = serials++;
			this.sessions = {};
			this.count = 0;
			//console.log("creating session", this.serial, data.Id, data.Userid, this);
			var id = data.Id;
			if (data.Id) {
				var userid = data.Userid || null;
				if (id === userid) {
					// Add as default with userid.
					this.use(userid, data);
				} else {
					// Add as session.
					var sessionData = this.add(id, data);
					if (userid) {
						this.auth(userid, sessionData);
					}
				}
			} else {
				this.use(null, {});
			}
		};

		BuddySession.prototype.add = function(id, data) {
			this.sessions[id] = data;
			if (this.count === 0) {
				this.use(id, data);
			}
			this.count++;
			sessions[id] = this;
			return data;
		};

		BuddySession.prototype.rm = function(id) {
			if (this.sessions.hasOwnProperty(id)) {
				delete this.sessions[id];
				this.count--;
			}
			delete sessions[id];
		};

		BuddySession.prototype.get = function(id) {
			if (!id) {
				id = this.Id;
			}
			return this.sessions[id];
		};

		BuddySession.prototype.use = function(id, data) {
			if (id) {
				this.Id = id;
			} else {
				this.Id = null;
			}
			//console.log("Use session as default", id, data, this);
		};

		BuddySession.prototype.remove = function(id, onEmptyCallback) {

			this.rm(id);
			if (id === this.Id) {
				var sessions = this.sessions;
				var sessionData;
				for (var sd in sessions) {
					if (sessions.hasOwnProperty(sd)) {
						sessionData = sessions[sd];
						break;
					}
				}
				if (sessionData) {
					this.use(sessionData.Id, sessionData);
				} else {
					//console.log("Last session removed", sessions);
					if (this.Userid) {
						//console.log("Using userid as session id");
						this.use(this.Userid);
					} else {
						this.use(null);
					}
					return true;
				}
			}
			return false;

		};

		BuddySession.prototype.update = function(id, data, onUseridCallback) {

			var userid = data.Userid;
			//console.log("session update", id, userid, this, data);

			var sessionData
			if (id === userid) {
				// Fake updates from userid ids.
				sessionData = data;
			} else {
				sessionData = this.get(id);
				if (!sessionData) {
					sessionData = this.add(id, data);
				}
			}
			if (userid) {
				this.auth(userid, sessionData, onUseridCallback);
			}
			if (data !== sessionData) {
				if (data.Rev) {
					sessionData.Rev = data.Rev;
				}
				if (data.Status) {
					sessionData.Status = data.Status;
				}
			}

			if (id === this.Id) {
				return sessionData;
			} else {
				return null;
			}

		};

		BuddySession.prototype.auth = function(userid, sessionData, onUseridCallback) {

			if (!this.Userid) {
				this.Userid = userid;
				//console.log("Session now has a user id", this.Id, userid);
			}
			// Trigger callback if defined and not triggered before.
			if (onUseridCallback && !sessionData.auth) {
				onUseridCallback(this);
				sessionData.auth = true;
			}

		};

		BuddySession.prototype.merge = function(otherSession) {
			if (!this.Userid) {
				console.error("Refusing to merge into session as we have no userid", this, otherSession);
				return;
			}
			if (otherSession.Userid !== this.Userid) {
				console.error("Refusing to merge other session with different userid", otherSession, this);
				return;
			}
			_.each(otherSession.sessions, _.bind(function(s, id) {
				if (this.sessions.hasOwnProperty(id)) {
					return;
				}
				this.add(id, s);
			}, this));
			//console.log("Merged sessions", this, otherSession);
		};

		return {
			create: function(data) {
				return new BuddySession(data);
			},
			sessions: function() {
				return sessions;
			}
		};

	}];

});
