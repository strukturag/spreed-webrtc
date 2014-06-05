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
define(["underscore"], function(_) {

	// buddySession
	return [function() {

		var BuddySession = function(data) {
			this.sessions = {};
			this.count = 0;
			if (data.Id) {
				this.add(data.Id, data);
				this.use(data);
				this.Userid = data.Userid || null;
			} else {
				this.set({});
			}
		};

		BuddySession.prototype.add = function(id, data) {
			this.sessions[id] = data;
			this.count++;
			return data;
		};

		BuddySession.prototype.rm = function(id) {
			delete this.sessions[id];
			this.count--;
		};

		BuddySession.prototype.get = function(id) {
			if (!id) {
				id = this.Id;
			}
			return this.sessions[id];
		};

		BuddySession.prototype.use = function(data) {
			this.Id = data.Id || null;
			this.Ua = data.Ua || "";
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
					//console.log("remove session", sessionData);
					this.use(sessionData);
				} else {
					console.log("Last session removed", sessions);
					return true;
				}
			}
			return false;

		};

		BuddySession.prototype.update = function(id, data, onUseridCallback) {

			var sessionData = this.sessions[id];
			if (!sessionData) {
				sessionData = this.add(id, data);
			}

			if (data.Userid && !this.Userid) {
				this.Userid = data.Userid;
				console.log("Session now has a user id", this.Id, data.Userid);
				if (onUseridCallback) {
					onUseridCallback(this);
				}
			}
			if (data.Rev) {
				sessionData.Rev = data.Rev;
			}

			if (data.Status) {
				sessionData.Status = data.Status;
			}

			if (id === this.Id) {
				return sessionData;
			} else {
				return null;
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
			console.log("Merged sessions", this, otherSession);
		};

		return {
			create: function(data) {
				return new BuddySession(data);
			}
		};

	}];

});
