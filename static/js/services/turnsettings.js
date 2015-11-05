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

define(["angular"], function(angular) {
	"use strict";

	/**
	 * turnSettings
	 * Service to correctly sync client and server side TURN settings to contraints.js
	 * See contraints.js for actual TURN configuration in use for a connection
	 */
	return ['mediaStream', 'appData', 'constraints', function(mediaStream, appData, constraints) {

		var preferClientSideTurnSettings = mediaStream.config.TurnURIsClientSideSetable;
		var turnConfigServer = null;

		/**
		 * @param Object config Turn configuration object
		 * @param Array config.urls
		 * @param String config.username
		 * @param String config.password
		 */
		var updateTurnSettings = function(config) {
			if (!preferClientSideTurnSettings) {
				return;
			}
			if (config.urls.length) {
				constraints.turn(config);
			// Apply original server side TURN settings when user removes client side TURN settings
			} else if (turnConfigServer && turnConfigServer.urls.length) {
				constraints.turn(turnConfigServer);
			}
		};

		if (preferClientSideTurnSettings) {
			// Overwrite server Turn settings when loading app
			appData.e.one("userSettingsLoaded", function(event, loadedUser, user) {
				if (user) {
					updateTurnSettings(user.settings.webrtc.turn);
				}
			});
			// Set server side TURN settings
			mediaStream.api.e.on("received.self", function(event, data) {
				if (data.Turn && data.Turn.urls.length) {
					turnConfigServer = data.Turn;
				}
			});
		}

		return {
			showClientSideTurnOptions: function() {
				return preferClientSideTurnSettings;
			},
			update: updateTurnSettings
		};

	}];
});
