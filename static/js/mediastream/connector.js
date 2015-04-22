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

	var timeout = 5000;
	var timeout_max = 20000;

	var Connector = function() {
		this.e = $({});
		this.error = false;
		this.connected = false;
		this.connecting = null;
		this.connecting_timeout = timeout;
		this.disabled = false;

		this.token = null;
		this.queue = [];
	};

	Connector.prototype.connect = function(url) {

		//console.log("connect", this.disabled, url);
		if (this.disabled) {
			return;
		}

		if (this.connecting !== null) {
			console.warn("Refusing to connect while already connecting");
			return;
		}

		this.error = false;
		this.e.triggerHandler("connecting", [url]);
		this.url = url;
		if (this.token) {
			url += ("?t=" + this.token);
			//console.log("Reusing existing token", this.token);
		}

		var that = this;

		// Create connection.
		var conn = this.conn = new WebSocket(url);
		conn.onopen = function(event) {
			if (event.target === that.conn) {
				that.onopen(event);
			}
		};
		conn.onerror = function(event) {
			if (event.target === that.conn) {
				that.onerror(event);
			}
		};
		conn.onclose = function(event) {
			if (event.target === that.conn) {
				that.onclose(event);
			}
		};
		conn.onmessage = function(event) {
			if (event.target === that.conn) {
				that.onmessage(event);
			}
		};

		this.connecting = window.setTimeout(_.bind(function() {
			console.warn("Connection timeout out after", this.connecting_timeout);
			if (this.connecting_timeout < timeout_max) {
				this.connecting_timeout += timeout;
			}
			this.e.triggerHandler("error");
			this.reconnect();
		}, this), this.connecting_timeout);

	};

	Connector.prototype.disconnect = function(error) {

		if (error) {
			this.onerror(null)
		} else {
			this.conn.close();
		}

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

		window.clearTimeout(this.connecting);
		this.connecting = null;
		this.connected = false;

		if (this.conn) {
			var conn = this.conn;
			this.conn = null;
			conn.close();
		}

	};

	Connector.prototype.forgetAndReconnect = function() {

		this.token = null;
		if (this.conn && this.connected) {
			this.conn.close();
		}

	};

	Connector.prototype.onopen = function(event) {

		window.clearTimeout(this.connecting);
		this.connecting = null;
		this.connecting_timeout = timeout;

		// Connection successfully established.
		console.info("Connector on connection open.");
		this.connected = true;
		this.e.triggerHandler("open", [null, event]);

		// Send out stuff which was previously queued.
		var data;
		while (this.queue.length > 0 && this.connected) {
			data = this.queue.shift();
			this.send(data);
		}

	};

	Connector.prototype.onerror = function(event) {

		window.clearTimeout(this.connecting);
		this.connecting = null;
		this.connecting_timeout = timeout;

		//console.log("onerror", event);
		console.warn("Connector on connection error.");
		this.error = true;
		this.close();
		this.e.triggerHandler("error", [null, event]);

	};

	Connector.prototype.onclose = function(event) {

		window.clearTimeout(this.connecting);
		this.connecting = null;
		this.connecting_timeout = timeout;

		//console.log("onclose", event);
		console.info("Connector on connection close.", event, this.error);
		this.close();
		if (!this.error) {
			this.e.triggerHandler("close", [null, event]);
		}

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
