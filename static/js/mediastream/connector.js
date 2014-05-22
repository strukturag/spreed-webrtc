/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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
define(['jquery', 'underscore', 'ua-parser'], function($, _, uaparser) {

	var timeout = 5000;
	var timeout_max = 20000;

	var Connector = function(version) {

		this.version = version;
		this.e = $({});
		this.error = false;
		this.connected = false;
		this.disabled = false;
		this.connecting = null;
		this.connecting_timeout = timeout;

		this.token = null;
		this.queue = [];

		this.roomid = null;

		var ua = uaparser();
		if (ua.os.name && /Spreed Desktop Caller/i.test(ua.ua)) {
			this.userAgent = ua.ua.match(/Spreed Desktop Caller\/([\d.]+)/i)[1] + " (" + ua.os.name + ")";
		} else if (ua.browser.name) {
			this.userAgent = ua.browser.name + " " + ua.browser.major;
		} else {
			this.userAgent = ua.ua;
		}

	};

	Connector.prototype.connect = function(url) {

		//console.log("connect", this.disabled, url);
		if (this.disabled) {
			return;
		}

		this.error = false;
		this.e.triggerHandler("connecting", [url]);
		this.url = url;
		if (this.token) {
			url += ("?t=" + this.token);
			//console.log("Reusing existing token", this.token);
		}
		var conn = this.conn = new WebSocket(url);
		conn.onopen = _.bind(this.onopen, this);
		conn.onerror = _.bind(this.onerror, this);
		conn.onclose = _.bind(this.onclose, this);
		conn.onmessage = _.bind(this.onmessage, this)

		this.connecting = window.setTimeout(_.bind(function() {
			console.warn("Connection timeout out after", this.connecting_timeout);
			if (this.connecting_timeout < timeout_max) {
				this.connecting_timeout += timeout;
			}
			this.e.triggerHandler("error");
			this.reconnect();
		}, this), this.connecting_timeout);

	};

	Connector.prototype.reconnect = function() {

		if (!this.url) {
			return;
		}

		this.close();

		var url = this.url;
		this.url = null;

		setTimeout(_.bind(function() {
			this.connect(url);
		}, this), 200);

	};

	Connector.prototype.close = function() {

		this.connected = false;
		if (this.conn) {
			var conn = this.conn;
			this.conn = null;
			if (!this.error) {
				conn.close();
			}
			conn.onopen = conn.onerror = conn.onclose = conn.onmessage = null;
		}

	};

	Connector.prototype.forgetAndReconnect = function() {

		this.token = null;
		if (this.conn && this.connected) {
			this.conn.close();
		}

	};

	Connector.prototype.room = function(roomid, cb) {

		var was_connected = this.connected;

		if (was_connected) {
			if (this.roomid === roomid) {
				return;
			}
			this.e.triggerHandler("closed", [{
				soft: true
			}]);
		}

		this.roomid = roomid;
		roomid = this.roomid ? this.roomid : "";

		if (cb) {
			cb();
		}

		this.send({
			Type: "Hello",
			Hello: {
				Version: this.version,
				Ua: this.userAgent,
				Id: roomid
			}
		});

		if (was_connected) {
			this.e.triggerHandler("open", [{
				soft: true
			}]);
		}

	};

	Connector.prototype.onopen = function(event) {

		window.clearTimeout(this.connecting);
		this.connecting_timeout = timeout;

		//console.log("onopen", event);
		console.info("Connector on connection open.");
		this.room(this.roomid, _.bind(function() {
			this.connected = true;
		}, this));
		this.e.triggerHandler("open", [event]);

		// Send out stuff which was previously queued.
		var data;
		while (this.queue.length > 0 && this.connected) {
			data = this.queue.shift();
			this.send(data);
		}

	};

	Connector.prototype.onerror = function(event) {

		window.clearTimeout(this.connecting);
		this.connecting_timeout = timeout;

		//console.log("onerror", event);
		console.warn("Connector on connection error.");
		this.error = true;
		this.close();
		this.e.triggerHandler("error", [event]);

	};

	Connector.prototype.onclose = function(event) {

		window.clearTimeout(this.connecting);
		this.connecting_timeout = timeout;

		//console.log("onclose", event);
		console.info("Connector on connection close.", event);
		this.close();
		if (!this.error) {
			this.e.triggerHandler("close", [event]);
		}
		this.e.triggerHandler("closed", [event]);

	};

	Connector.prototype.onmessage = function(event) {

		//console.log("onmessage", event);
		var msg = JSON.parse(event.data);
		this.e.triggerHandler("received", [msg]);

	};

	Connector.prototype.send = function(data, noqueue) {

		if (!this.connected) {
			if (!noqueue) {
				this.queue.push(data);
				console.warn("Queuing sending data because of not connected.", data);
				return;
			}
		}
		this.conn.send(JSON.stringify(data));

	};

	Connector.prototype.ready = function(func) {
		/* Call a function whenever the Connection is ready */
		this.e.on("open", func);
		if (this.connected) {
			func();
		}
	};

	return Connector;

});
