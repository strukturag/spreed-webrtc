/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2016 struktur AG
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
define(["jquery"], function($) {
	var geoRequestTimeout = 30000; // Timeout for geo requests in milliseconds.
	var geoFastRetryTimeout = 45000; // Refresh timer in milliseconds, after which GEO requests should be retried if failed before.
	var refreshPercentile = 90; // Percent of the TTL when TURN credentials should be refreshed.

	// turnData
	return ["$timeout", "$http", "api", "randomGen", "appData", function($timeout, $http, api, randomGen, appData) {
		var ttlTimeout = null;
		var geoRefresh = null;
		var geoPreferred = null;

		var service = this;
		service.e = $({});
		service.data = {};

		service.apply = function() {
			var turn = service.data;
			var turnData = {
				"username": turn.username,
				"password": turn.password,
				"ttl": turn.ttl
			};
			if (turn && turn.servers) {
				// Multiple options, need to sort and use settings.
				if (!turn.serverMap) {
					var servers = {};
					turn.servers.sort(function(a, b) {
						servers[a.id] = a;
						servers[b.id] = b;
						return (a.prio > b.prio) ? 1 : ((a.prio < b.prio) ? -1 : 0);
					});
					turn.first = turn.servers[0];
					if (turn.geo_uri) {
						turn.servers.unshift({
							"id": "auto"
						})
					}
					turn.serverMap = servers;
				}
				var urls;
				if (turn.preferred) {
					for (var i=0; i<turn.preferred.length; i++) {
						if (turn.serverMap.hasOwnProperty(turn.preferred[i])) {
							urls = turn.serverMap[turn.preferred[i]].urns;
							break;
						}
					}
				}
				if (!urls && turn.first) {
					urls = turn.first.urns;
				}
				turnData.urls = urls;
			} else if (turn && turn.urls) {
				// Simple case, single region.
				turnData.urls = turn.urls
			} else {
				// Unknown data.
				turnData.urls = [];
			}
			console.log("TURN servers selected: ", turnData.urls, turn.preferred || null);
			service.e.triggerHandler("apply", [turnData]);

			return turnData;
		};

		service.refresh = function(withGeo) {
			$timeout.cancel(geoRefresh);

			var turn = service.data;
			service.e.triggerHandler("refresh", [turn]);
			if (turn.selected === "auto" && turn.geo_uri) {
				if (geoPreferred !== null) {
					// Use existing data.
					turn.preferred = geoPreferred;

				} else {
					if (!withGeo) {
						// Avoid triggering spurious GEO request for fast updates.
						geoRefresh = $timeout(function() {
							service.refresh(true);
						}, 1000);
						return;
					}

					// Run Geo request.
					var nonce = randomGen.random({hex: true});
					$http({
						method: "POST",
						url: turn.geo_uri,
						headers: {"Content-Type": "application/x-www-form-urlencoded"},
						data: "nonce="+encodeURIComponent(nonce)+"&username="+encodeURIComponent(turn.username)+"&password="+encodeURIComponent(turn.password),
						timeout: geoRequestTimeout
					}).then(function(response) {
						// success
						if (turn !== service.data) {
							// No longer our data.
							return;
						}
						if (response.status === 200) {
							var data = response.data;
							if (data.success && data.nonce === nonce) {
								geoPreferred = turn.preferred = data.geo.prefer;
								console.log("TURN GEO auto selected: ", turn.preferred);
								service.apply();
							}
						}
					}, function(response) {
						// failed
						if (turn !== service.data) {
							// No longer our data.
							return;
						}
						console.warn("TURN GEO failed:", response.status, response);
						$timeout.cancel(ttlTimeout);
						ttlTimeout = $timeout(function() {
							// Fast retry.
							console.warn("TURN GEO failed - refreshing early.")
							api.sendSelf();
						}, geoFastRetryTimeout)
					})
				}
			} else {
				// Set directly.
				turn.preferred = [];
				if (turn.selected) {
					turn.preferred.push(turn.selected);
				}
			}
			service.apply();
		};

		service.update = function(turn) {
			$timeout.cancel(ttlTimeout);
			if (service.data && service.data.preferred) {
				// Keep preferred list if there is one.
				turn.preferred = service.data.preferred;
			}
			service.data = turn;
			service.refresh()

			// Support to refresh TURN data when ttl was reached.
			if (turn.ttl) {
				ttlTimeout = $timeout(function() {
					console.log("TURN TTL reached - sending refresh request.");
					api.sendSelf();
				}, turn.ttl * 0.01 * refreshPercentile * 1000);
			}
		};

		service.cancel = function() {
			$timeout.cancel(ttlTimeout);
		}

		appData.e.on("userSettingsLoaded", service.refresh);

		return service;
	}]
})
