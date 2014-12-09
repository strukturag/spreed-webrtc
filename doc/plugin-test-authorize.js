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

"use strict";
define(['angular', 'sjcl'], function(angular, sjcl) {

	return {

		initialize: function(app) {

			var lastNonce = null;
			var lastUserid = null;
			var lastData = null;
			var disconnectTimeout = null;

			app.run(["$window", "mediaStream", function($window, mediaStream) {

				console.log("Injecting test plugin functions to window ...");

				$window.testDisconnect = function() {
					if (disconnectTimeout) {
						$window.clearInterval(disconnectTimeout);
						disconnectTimeout = null;
						console.info("Stopped disconnector.");
						return;
					}
					disconnectTimeout = $window.setInterval(function() {
						console.info("Test disconnect!");
						mediaStream.connector.conn.close();
					}, 10000);
					console.info("Started disconnector.");
				};

				$window.testCreateSuseridLocal = function(key, userid) {

					var k = sjcl.codec.utf8String.toBits(key);
					var foo = new sjcl.misc.hmac(k, sjcl.hash.sha256);
					var expiration = parseInt(((new Date()).getTime()/1000)+3600, 10);
					var useridCombo = ""+expiration+":"+userid;
					var secret = foo.mac(useridCombo);
					var data = {
						useridcombo: useridCombo,
						secret: sjcl.codec.base64.fromBits(secret)
					};
					lastData = data;
					return data;

				};

				$window.testCreateSuseridServer = function() {
					mediaStream.users.register(null, function(data) {
						console.log("Retrieved user", data);
						lastData = data;
					}, function() {
						console.log("Register error", arguments);
					});
				};

				$window.testAuthorize = function(data) {
					console.log("Testing authorize with data", data);
					mediaStream.users.authorize(data, function(data) {
						lastNonce = data.nonce;
						lastUserid = data.userid;
						console.log("Retrieved nonce", lastNonce, lastUserid);
					}, function() {
						console.log("Authorize error", arguments);
					});
				};

				$window.testLastAuthenticate = function() {
					if (!lastNonce || !lastUserid) {
						console.log("Run testAuthorize first.");
						return;
					}
					mediaStream.api.requestAuthentication(lastUserid, lastNonce);
				};

				$window.testLastAuthorize = function() {
					if (lastData === null) {
						console.log("Run testCreateSuseridServer fist.");
						return;
					}
					$window.testAuthorize(lastData);
				};

			}]);

		}

	};

});
