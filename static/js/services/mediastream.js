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
define([
	'jquery',
	'underscore',
	'ua-parser',
	'sjcl',
	'modernizr',
	'mediastream/tokens',
	'webrtc.adapter'

], function($, _, uaparser, sjcl, Modernizr, tokens) {

	return ["globalContext", "connector", "api", "webrtc", "appData", "$route", "$location", "$window", "visibility", "alertify", "$http", "safeApply", "$timeout", "$sce", "localStorage", "continueConnector", "restURL", function(context, connector, api, webrtc, appData, $route, $location, $window, visibility, alertify, $http, safeApply, $timeout, $sce, localStorage, continueConnector, restURL) {

		var url = (context.Ssl ? "wss" : "ws") + "://" + context.Host + (context.Cfg.B || "/") + "ws";
		var version = context.Cfg.Version;
		console.log("Service version: " + version);
		console.log("Ws URL: " + url);
		console.log("Secure Contextual Escaping: " + $sce.isEnabled());

		var connectMarker = null;

		// Create encryption key from server token and browser name.
		var secureKey = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(context.Cfg.Token + uaparser().browser.name));

		// Apply configuration details.
		webrtc.settings.renegotiation = context.Cfg.Renegotiation && true;
		if (webrtc.settings.renegotiation && $window.webrtcDetectedBrowser !== "chrome") {
			console.warn("Disable renegotiation in anything but Chrome for now.");
			webrtc.settings.renegotiation = false;
		}

		// mediaStream service API.
		var mediaStream = {
			version: version,
			ws: url,
			config: context.Cfg,
			webrtc: webrtc,
			connector: connector,
			api: api,
			tokens: tokens,
			users: {
				register: function(form, success_cb, error_cb) {
					var url = restURL.api("users");
					if (form) {
						// Form submit mode.
						$(form).attr("action", url).attr("method", "POST");
						var idE = $('<input name="id" type="hidden">');
						idE.val(mediaStream.api.id);
						var sidE = $('<input name="sid" type="hidden">');
						sidE.val(mediaStream.api.sid);
						$(form).append(idE);
						$(form).append(sidE);
						var iframe = $(form).find("iframe");
						form.submit();
						$timeout(function() {
							idE.remove();
							sidE.remove();
							idE = null;
							sidE = null;
						}, 0);
						var retries = 0;
						var authorize = function() {
							mediaStream.users.authorize({
								count: retries
							}, success_cb, function(data, status) {
								// Error handler retry.
								retries++;
								if (retries <= 10) {
									$timeout(authorize, 2000);
								} else {
									console.error("Failed to authorize session", status, data);
									if (error_cb) {
										error_cb(data, status)
									}
								}
							});
						};
						$timeout(authorize, 1500);
					} else {
						// AJAX mode.
						var data = {
							id: mediaStream.api.id,
							sid: mediaStream.api.sid
						}
						$http({
							method: "POST",
							url: url,
							data: JSON.stringify(data),
							headers: {
								'Content-Type': 'application/json'
							}
						}).
						success(function(data, status) {
							if (data.userid !== "" && data.success) {
								success_cb(data, status);
							} else {
								if (error_cb) {
									error_cb(data, status);
								}
							}
						}).
						error(function(data, status) {
							if (error_cb) {
								error_cb(data, status)
							}
						});
					}
				},
				authorize: function(data, success_cb, error_cb) {
					appData.authorizing(true);
					var url = restURL.api("sessions") + "/" + mediaStream.api.id + "/";
					var login = _.clone(data);
					login.id = mediaStream.api.id;
					login.sid = mediaStream.api.sid;
					$http({
						method: "PATCH",
						url: url,
						data: JSON.stringify(login),
						headers: {
							'Content-Type': 'application/json'
						}
					}).
					success(function(data, status) {
						if (data.nonce !== "" && data.success) {
							success_cb(data, status);
						} else {
							appData.authorizing(false);
							if (error_cb) {
								error_cb(data, status);
							}
						}
					}).
					error(function(data, status) {
						appData.authorizing(false);
						if (error_cb) {
							error_cb(data, status)
						}
					});
				},
				store: function(data) {
					// So we store the stuff in localStorage for later use.
					var store = _.clone(data);
					store.v = 42; // No idea what number - so use 42.
					var login = sjcl.encrypt(secureKey, JSON.stringify(store));
					localStorage.setItem("mediastream-login-" + context.Cfg.UsersMode, login);
					return login;
				},
				load: function() {
					// Check if we have something in store.
					var login = localStorage.getItem("mediastream-login-" + context.Cfg.UsersMode);
					if (login) {
						try {
							login = sjcl.decrypt(secureKey, login);
							login = JSON.parse(login)
						} catch (err) {
							console.error("Failed to parse stored login data", err);
							login = {};
						}
						switch (login.v) {
							case 42:
								return login;
							default:
								console.warn("Unknown stored credentials", login.v);
								break;
						}
					}
					return null;
				},
				forget: function() {
					localStorage.removeItem("mediastream-login-" + context.Cfg.UsersMode);
				}
			},
			connect: function() {
				var myMarker = {};
				connectMarker = myMarker;
				continueConnector.then(function() {
					if (connectMarker === myMarker) {
						console.log("Connecting ...");
						connector.connect(url);
					}
				});
			},
			reconnect: function() {
				var myMarker = {};
				connectMarker = myMarker;
				continueConnector.then(function() {
					if (connectMarker === myMarker) {
						console.log("Reconnecting ...");
						connector.reconnect();
					}
				});
			},
			initialize: function($rootScope, translation) {

				var cont = false;
				var ready = false;

				$rootScope.version = version;
				$rootScope.connect = false;

				var connect = function() {
					// We need websocket support to connect.
					if (!Modernizr.websockets) {
						console.error("This browser has no support for websockets. Connect aborted.");
						return;
					}
					if (ready && cont) {
						// Inject connector function into scope, so that controllers can pick it up.
						console.log("Ready to connect ...");
						mediaStream.connect();
						safeApply($rootScope, function(scope) {
							scope.connect = true;
						});
					}
				};

				$rootScope.$on("rooms.ready", function(event) {
					console.info("Initial room path set, continuing to connect ...");
					ready = true;
					connect();
				});

				visibility.afterPrerendering(function() {

					// Hide loader when we are visible.
					var loader = $("#loader");
					loader.addClass("done");
					_.delay(function() {
						loader.remove();
					}, 1000);

					if (context.Cfg.Tokens) {
						var prompt, check;
						var storedCode = localStorage.getItem("mediastream-access-code");
						prompt = function() {
							alertify.dialog.prompt(translation._("Access code required"), function(code) {
								if (!code) {
									prompt();
								} else {
									check(code);
									return;
								}
							}, prompt);
						};
						var url = restURL.api("tokens");
						check = function(code) {
							$http({
								method: "POST",
								url: url,
								data: $.param({
									a: code
								}),
								headers: {
									'Content-Type': 'application/x-www-form-urlencoded'
								}
							}).
							success(function(data, status) {
								if (data.token !== "" && data.success) {
									localStorage.setItem("mediastream-access-code", code);
									cont = true;
									connect();
								} else {
									alertify.dialog.error(translation._("Access denied"), translation._("Please provide a valid access code."), function() {
										prompt();
									});
								}
							}).
							error(function(data, status) {
								if ((status == 403 || status == 413) && data.success === false) {
									alertify.dialog.error(translation._("Access denied"), translation._("Please provide a valid access code."), function() {
										prompt();
									});
								} else {
									alertify.dialog.error(translation._("Error"), translation._("Failed to verify access code. Check your Internet connection and try again."), function() {
										prompt();
									});
								}
							});
						};
						if (storedCode) {
							check(storedCode);
						} else {
							prompt();
						}
					} else {
						cont = true;
						connect();
					}

				});

			}
		};

		return mediaStream;

	}];

});
