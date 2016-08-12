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
define(['jquery', 'underscore', 'bigscreen', 'moment', 'sjcl', 'modernizr', 'webrtc.adapter'], function($, _, BigScreen, moment, sjcl, Modernizr) {

	return ["$scope", "$rootScope", "$element", "$window", "$timeout", "safeDisplayName", "safeApply", "mediaStream", "appData", "playSound", "desktopNotify", "alertify", "toastr", "translation", "fileDownload", "localStorage", "screensharing", "localStatus", "dialogs", "rooms", "constraints", function($scope, $rootScope, $element, $window, $timeout, safeDisplayName, safeApply, mediaStream, appData, playSound, desktopNotify, alertify, toastr, translation, fileDownload, localStorage, screensharing, localStatus, dialogs, rooms, constraints) {

		alertify.dialog.registerCustom({
			baseType: 'notify',
			type: 'webrtcUnsupported',
			message: translation._("Your browser does not support WebRTC. No calls possible.")
		});

		// Avoid accidential reloads or exits when in a call.
		$($window).on("beforeunload", function(event) {
			if (appData.flags.manualUnload || !$scope.peer) {
				return;
			}
			return translation._("Close this window and disconnect?");
		});

		$($window).on("unload", function() {
			mediaStream.webrtc.doHangup("unload");
			if (mediaStream.api.connector) {
				mediaStream.api.connector.disabled = true;
			}
		});

		// Enable app full screen listener.
		$("#bar .logo").on("doubletap dblclick", _.debounce(function() {
			if (BigScreen.enabled) {
				BigScreen.toggle($("body").get(0));
			}
		}, 100, true));

		// Helper to test WebRTC stats api.
		$window.showCiphers = function() {

			var prettyPrint = function(obj) {
				return JSON.stringify(obj, null, 2)
			};

			var processStatsReport = function(report) {
				var channels = {};
				for (var i in report) {
					if (report.hasOwnProperty(i)) {
						var entry = report[i];
						var channel = null;
						if (entry.type === "googCandidatePair") {
							// Chrome candidate pair.
							if (!entry.googActiveConnection) {
								continue
							}
							channel = report[entry.googChannelId];
						} else {
							continue;
						}
						if (channel && !channels[channel.id]) {
							channels[channel.id] = true;
							console.info("Connected channel", prettyPrint(channel));
							var localCertificate = report[channel.localCertificateId];
							var remoteCertificate = report[channel.remoteCertificateId];
							console.info("Local  certificate", prettyPrint(localCertificate));
							console.info("Remote certificate", prettyPrint(remoteCertificate));
						}
					}
				}
			};

			mediaStream.webrtc.callForEachCall(function(c) {
				if (c.peerconnection && c.peerconnection.pc) {
					c.peerconnection.pc.getStats(null, function(report) {
						processStatsReport(report);
					}, function(error) {
						console.log("Failed to retrieve stats report", error);
					});
				}
			});

		};

		// Load default sounds.
		playSound.initialize({
			urls: ['sounds/sprite1.ogg', 'sounds/sprite1.mp3'],
			sprite: {
				"connect1": [
				0,
				5179],
				"end1": [
				12892,
				6199],
				"entry1": [
				8387,
				3000],
				"leaving1": [
				5228,
				2126],
				"message1": [
				19140,
				816],
				"question1": [
				20006,
				3313],
				"ringtone1": [
				7403,
				935],
				"whistle1": [
				11437,
				1405]
			}
		}, null, {
			"ring": "whistle1",
			"joined": "entry1",
			"left": "leaving1",
			"end": "end1",
			"dial": "ringtone1",
			"connect": "connect1",
			"prompt": "question1",
			"chatmessage": "message1"
		});

		var displayName = safeDisplayName;

		// Init STUN from server config.
		(function() {
			var stun = mediaStream.config.StunURIs || [];
			constraints.stun(stun);
		})();

		// Add browser details for easy access.
		$scope.isChrome = $window.webrtcDetectedBrowser === "chrome";
		$scope.webrtcDetectedBrowser = $window.webrtcDetectedBrowser;
		$scope.webrtcDetectedVersion = $window.webrtcDetectedVersion;

		// Add support status.
		$scope.supported = {
			screensharing: screensharing.supported,
			constraints: constraints.supported
		};

		// Default scope data.
		$scope.status = "initializing";
		$scope.id = $scope.myid = null;
		$scope.userid = $scope.myuserid = null;
		$scope.suserid = null;
		$scope.peer = null;
		$scope.dialing = null;
		$scope.conference = null;
		$scope.conferenceObject = null;
		$scope.conferencePeers = [];
		$scope.incoming = null;
		$scope.microphoneMute = false;
		$scope.cameraMute = false;
		$scope.layout = {
			main: null,
		};
		$scope.chatMessagesUnseen = 0;
		$scope.autoAccept = null;
		$scope.isCollapsed = true;
		$scope.usermedia = null;

		$scope.setStatus = function(status) {
			// This is the connection status to signaling server.
			$scope.$emit("status", status);
		};

		$scope.getStatus = function() {
			return $scope.status;
		};

		$scope.updateStatus = function(clear) {
			// This is the user status.
			var status = {
				displayName: $scope.master.displayName || null,
				buddyPicture: $scope.master.buddyPicture || null,
				message: $scope.master.message || null
			}
			if (clear) {
				localStatus.clear();
			}
			localStatus.update(status);
		};

		$scope.isConferenceRoom = function() {
			return mediaStream.webrtc.isConferenceRoom();
		};

		$scope.updatePeerFromConference = function() {
			if (!$scope.conferenceObject) {
				$scope.conferencePeers.length = 0;
				return;
			}

			var peerIds = $scope.conferenceObject.getCallIds();
			if ($scope.peer && peerIds.indexOf($scope.peer) === -1) {
				$scope.peer = null;
			}
			if (!$scope.peer) {
				$scope.peer = peerIds.length > 0 ? peerIds.shift() : null;
			} else {
				peerIds = _.without(peerIds, $scope.peer);
			}
			$scope.conferencePeers = peerIds;
		};

		$scope.setConnectedStatus = function() {
			// Don't set connected states if no peer is known yet. Otherwise
			// there would be "Someone" visible in the UI.
			$scope.updatePeerFromConference();
			if (!$scope.peer) {
				return;
			}

			if ($scope.conference || $scope.isConferenceRoom()) {
				$scope.setStatus("conference");
			} else {
				$scope.setStatus("connected");
			}
		};

		$scope.clearConnectedStatus = function() {
			if (mediaStream.connector.connected) {
				$scope.setStatus("waiting");
			} else {
				$scope.setStatus("closed");
			}
		};

		$scope.refreshWebrtcSettings = function() {
			var settings = $scope.master.settings;
			// Refresh SDP params.
			if (settings.experimental.enabled && settings.experimental.preferVideoSendCodecVP9) {
				// Prefer VP9.
				mediaStream.webrtc.settings.sdpParams.videoSendCodec = "VP9/90000";
			} else {
				// Else prefer VP8.
				mediaStream.webrtc.settings.sdpParams.videoSendCodec = "VP8/90000";
			}
			// Refresh constraints.
			constraints.refresh($scope.master.settings).then(function() {
				var um = $scope.usermedia;
				if (um && um.renegotiation && um.started) {
					// Trigger renegotiation if supported and started.
					um.doGetUserMediaWithConstraints(mediaStream.webrtc.settings.mediaConstraints);
				}
			});
		};
		$scope.refreshWebrtcSettings(); // Call once for bootstrap.

		$scope.refreshSoundSettings = function() {
			var s = $scope.master.settings.sound;
			playSound.disable("chatmessage", !s.incomingMessages);
			playSound.disable("ring", !s.incomingCall);
			var roomJoinLeave = $scope.peer ? false : s.roomJoinLeave; // Do not play these sounds when in call.
			playSound.disable("joined", !roomJoinLeave);
			playSound.disable("left", !roomJoinLeave);
		};
		$scope.refreshSoundSettings(); // Call once on bootstrap;

		var pickupTimeout = null;
		var autoAcceptTimeout = null;
		var ringerTimeout = null;
		$scope.updateAutoAccept = function(id, from) {

			if (id) {
				console.log("Auto accept requested", id);
				$scope.autoAccept = id;
				$timeout.cancel(autoAcceptTimeout);
				autoAcceptTimeout = $timeout(function() {
					$scope.autoAccept = null;
					console.warn("Auto accept expired!")
					safeApply($scope);
				}, 2000);
			} else {
				if ($scope.autoAccept && $scope.autoAccept === from) {
					$scope.autoAccept = null;
					$timeout.cancel(autoAcceptTimeout);
					console.log("Auto accept success", from)
					return from;
				}
				return null;
			}

		};

		$scope.toggleBuddylist = (function() {
			var oldState = null;
			return function(status, force) {
				if (status || force) {
					oldState = $scope.layout.buddylist;
					$scope.layout.buddylist = !! status;
				} else {
					$scope.layout.buddylist = oldState;
				}
			}
		}());

		$scope.openContactsManager = (function() {
			var oldDialog = null;
			return function() {
				if (oldDialog) {
					oldDialog.dismiss("open");
				}
				oldDialog = dialogs.create(
					"/contactsmanager/main.html",
					"ContactsmanagerController",
					{
						header: translation._("Contacts Manager")
					}, {
						wc: "contactsmanager"
					}
				);
				oldDialog.result.finally(function() {
					oldDialog = null;
				});
				return oldDialog
			}
		}());

		$scope.$watch("cameraMute", function(cameraMute) {
			mediaStream.webrtc.setVideoMute(cameraMute);
		});

		$scope.$watch("microphoneMute", function(cameraMute) {
			mediaStream.webrtc.setAudioMute(cameraMute);
		});

		$scope.$watch("peer", function(c, o) {
			// Watch for peer and disable some sounds while there is a peer.
			if (c && !o) {
				// New call.
				$scope.refreshSoundSettings();
			} else if (!c && o) {
				// No longer in call.
				$scope.refreshSoundSettings();
			}
		});

		var ringer = playSound.interval("ring", null, 4000);
		var dialer = playSound.interval("dial", null, 4000);
		var dialerEnabled = false;
		var notification;
		var ttlTimeout;
		var reloadDialog = false;

		mediaStream.api.e.on("received.self", function(event, data) {

			$timeout.cancel(ttlTimeout);
			safeApply($scope, function(scope) {
				scope.id = scope.myid = data.Id;
				scope.userid = scope.myuserid = data.Userid ? data.Userid : null;
				scope.suserid = data.Suserid ? data.Suserid : null;
			});

			// Set TURN and STUN data and refresh webrtc settings.
			constraints.turn(data.Turn);
			constraints.stun(data.Stun);
			$scope.refreshWebrtcSettings();

			if (data.Version !== mediaStream.version) {
				console.info("Server was upgraded. Reload required.");
				if (!reloadDialog) {
					reloadDialog = true;
					_.delay(function() {
						alertify.dialog.confirm(translation._("Restart required to apply updates. Click ok to restart now."), function() {
							$scope.manualReloadApp();
						}, function() {
							reloadDialog = false;
						});
					}, 300);
				}
			}

			// Support authentication from localStorage.
			if (!data.Userid && mediaStream.config.UsersEnabled) {
				// Check if we can load a user.
				var login = mediaStream.users.load();
				if (login !== null) {
					$scope.loadedUserlogin = true;
					console.log("Trying to authorize with stored credentials ...");
					mediaStream.users.authorize(login, function(data) {
						console.info("Retrieved nonce - authenticating as user:", data.userid);
						mediaStream.api.requestAuthentication(data.userid, data.nonce);
						delete data.nonce;
					}, function(data, status) {
						console.error("Failed to authorize session", status, data);
						mediaStream.users.forget();
					});
				} else {
					$scope.loadedUserlogin = false;
				}
			}

			// Support to upgrade stuff when ttl was reached.
			if (data.Turn.ttl) {
				ttlTimeout = $timeout(function() {
					console.log("Ttl reached - sending refresh request.");
					mediaStream.api.sendSelf();
				}, data.Turn.ttl / 100 * 90 * 1000);
			}

			// Support resurrection shrine.
			if (appData.flags.resurrect) {
				var resurrection = appData.flags.resurrect;
				appData.flags.resurrect = null;
				$timeout(function() {
					if (resurrection.id === $scope.id) {
						console.log("Using resurrection shrine", resurrection);
						// Valid resurrection.
						$scope.setStatus(resurrection.status);
					}
				}, 0);
			}

			// Propagate authentication event.
			appData.e.triggerHandler("selfReceived", [data]);

			// Unmark authorization process.
			if (data.Userid) {
				appData.authorizing(false, data.Userid);
			} else {
				if (!appData.authorizing()) {
					// Trigger user data load when not in authorizing phase.
					$scope.loadUserSettings();
				} else {
					// Wait until authorizing is over and try it then.
					var handler = (function() {
						return function(event, authorizing, userid) {
							if (!authorizing) {
								// Turn of handler if we are no longer authorizing.
								appData.e.off("authorizing", handler);
								handler = null;
								if (!userid) {
									// Trigger user data load when without user after authorizing phase.
									$scope.loadUserSettings();
								}
							}
						}
					})();
					appData.e.on("authorizing", handler);
				}
			}

			// Select room if settings have an alternative default room.
			if (rooms.inDefaultRoom() && $scope.master.settings.defaultRoom) {
				console.log("Selecting default room from settings:", [$scope.master.settings.defaultRoom]);
				rooms.joinByName($scope.master.settings.defaultRoom, true);
			}

		});

		mediaStream.webrtc.e.on("peercall", function(event, peercall) {

			// Kill timeout.
			$timeout.cancel(pickupTimeout);
			pickupTimeout = null;
			// Kill ringer.
			if (peercall && peercall.isOutgoing()) {
				dialerEnabled = true;
			} else {
				dialerEnabled = false;
			}
			ringer.stop();
			// Close notifications.
			if (notification) {
				notification.close();
			}
			// Apply peer call to scope.
			safeApply($scope, function(scope) {
				scope.peer = peercall ? peercall.id : null;
				scope.setConnectedStatus();
			});
		});

		mediaStream.webrtc.e.on("peerconference", function(event, peerconference) {
			safeApply($scope, function(scope) {
				scope.conference = peerconference ? peerconference.id : null;
				scope.conferenceObject = peerconference ? peerconference : null;
				scope.updatePeerFromConference();
				scope.setConnectedStatus();
			});
		});

		mediaStream.webrtc.e.on("offer", function(event, from, to2, to) {
			safeApply($scope, function(scope) {
				scope.incoming = from;
			});
			if ($scope.updateAutoAccept(null, from)) {
				// Auto accept support.
				mediaStream.webrtc.doAccept(from);
				return;
			}
			// Start to ring.
			ringer.start();
			// Show incoming call notification.
			notification = desktopNotify.notify(translation._("Incoming call"), translation._("from") + " " + displayName(from), {
				timeout: null
			});
			$scope.$emit("status", "ringing");
			// Start accept timeout.
			pickupTimeout = $timeout(function() {
				console.log("Pickup timeout reached.");
				mediaStream.webrtc.doHangup("pickuptimeout", from);
				$scope.$emit("notification", "incomingpickuptimeout", {
					reason: 'pickuptimeout',
					from: from
				});
			}, 30000);
			appData.e.triggerHandler("uiNotification", ["incoming", {from: from}]);
		});

		mediaStream.webrtc.e.on("error", function(event, message, msgid) {
			switch (msgid) {
				case "failed_getusermedia":
					message = translation._("Failed to access camera/microphone.");
					break;
				case "failed_peerconnection_setup":
				case "failed_peerconnection":
					message = translation._("Failed to establish peer connection.")
					break;
			}
			if (!message) {
				message = msgid;
			}
			if (!message) {
				message = translation._("We are sorry but something went wrong. Boo boo.");
			}
			alertify.dialog.alert(translation._("Oops") + "<br/>" + message);
		});

		mediaStream.webrtc.e.on("usermedia", function(event, usermedia) {
			safeApply($scope, function(scope) {
				scope.usermedia = usermedia;
			});
		});

		appData.flags.autoreconnect = true;
		appData.flags.autoreconnectDelay = 0;

		var reconnect = function() {
			if (appData.flags.connected && appData.flags.autoreconnect) {
				if (appData.flags.resurrect === null) {
					// Store data at the resurrection shrine.
					appData.flags.resurrect = {
						status: $scope.getStatus(),
						id: $scope.id
					}
					console.log("Stored data at the resurrection shrine", appData.flags.resurrect);
				}
				if (!appData.flags.reconnecting) {
					var delay = appData.flags.autoreconnectDelay;
					if (delay < 10000) {
						appData.flags.autoreconnectDelay += 500;
					}
					appData.flags.reconnecting = true;
					_.delay(function() {
						if (appData.flags.autoreconnect) {
							console.log("Requesting to reconnect ...");
							mediaStream.reconnect();
						}
						appData.flags.reconnecting = false;
					}, delay);
					$scope.setStatus("reconnecting");
				} else {
					console.warn("Already reconnecting ...");
				}
			} else {
				$scope.setStatus("closed");
			}
		};

		mediaStream.connector.e.on("open error close", function(event) {
			$timeout.cancel(ttlTimeout);
			$scope.userid = $scope.suserid = null;
			switch (event.type) {
				case "open":
					appData.flags.connected = true;
					appData.flags.autoreconnectDelay = 0;
					$scope.updateStatus(true);
					$scope.setStatus("waiting");
					break;
				case "error":
					if (appData.flags.connected) {
						reconnect();
					} else {
						$scope.setStatus(event.type);
					}
					break;
				case "close":
					reconnect();
					break;
			}
		});

		mediaStream.webrtc.e.on("waitforusermedia connecting", function(event, currentcall) {
			var t = event.type;
			safeApply($scope, function(scope) {
				scope.dialing = currentcall ? currentcall.id : null;
				scope.setStatus(t);
			});
		});

		mediaStream.webrtc.e.on("statechange", function(event, state, currentcall) {
			console.info("P2P state changed", state, currentcall.id);
			switch (state) {
				case "closed":
					if ($scope.getStatus() === "closed" || $scope.getStatus() === "waiting") {
						return;
					}
					// This changes back from "conference" to "connected" if a
					// conference is downgraded to p2p call.
					/* falls through */
				case "completed":
				case "connected":
					$scope.setConnectedStatus();
					break;
				case "failed":
					var wasConnected = !currentcall.closed;
					mediaStream.webrtc.doHangup("failed", currentcall.id);
					if (!wasConnected) {
						alertify.dialog.alert(translation._("Peer connection failed. Check your settings."));
					}
					break;
			}
		});

		// Start heartbeat timer.
		$window.setInterval(function() {
			mediaStream.api.heartbeat(5000, 11500)
		}, 1000);

		$scope.$on("active", function(event, currentcall) {

			console.info("Video state active (assuming connected)", currentcall.id);
			$scope.setConnectedStatus();
			$timeout(function() {
				if ($scope.peer) {
					$scope.layout.buddylist = false;
					$scope.layout.buddylistAutoHide = true;
				}
			}, 1000);

		});

		$scope.$on("mainview", function(event, mainview, state) {
			console.info("Main view update", mainview, state);
			var changed = false;
			var layout = $scope.layout;
			if (layout.main === mainview && !state) {
				layout.main = null;
				changed = true;
			} else if (state) {
				layout.main = mainview;
				changed = true;
			}
			if (changed) {
				$scope.$broadcast("mainresize", layout.main);
			}
		});

		$scope.$watch("userid", function(userid, olduserid) {
			var suserid;
			if (userid) {
				suserid = $scope.suserid;
				console.info("Session is now authenticated:", userid, suserid);
			}
			if (userid !== olduserid) {
				appData.e.triggerHandler("authenticationChanged", [userid, suserid]);
				// Load user settings after authentication changed.
				$scope.loadUserSettings();
			}
		});

		$scope.$on("room.updated", function(event, room) {
			$scope.roomType = room ? room.Type : null;
		});

		// Apply all layout stuff as classes to our element.
		$scope.$watch("layout", (function() {
			var makeName = function(prefix, n) {
				return prefix + n.charAt(0).toUpperCase() + n.slice(1);
			};
			return function(layout, old) {
				_.each(layout, function(v, k) {
					if (k === "main") {
						return;
					}
					var n = makeName("with", k);
					if (v) {
						$element.addClass(n);
					} else {
						$element.removeClass(n);
					}
				});
				if (old.main !== layout.main) {
					if (old.main) {
						$element.removeClass(makeName("main", old.main));
					}
					if (layout.main) {
						$element.addClass(makeName("main", layout.main));
					}
				}
				$scope.$broadcast("mainresize", layout.main);
			}
		}()), true);

		mediaStream.webrtc.e.on("done stop", function() {
			safeApply($scope, function(scope) {
				scope.clearConnectedStatus();
			});
		});

		mediaStream.webrtc.e.on("busy", function(event, from) {
			console.log("Incoming call - sent busy.", from);
			$scope.$emit("notification", "incomingbusy", {
				reason: 'busy',
				from: from
			});
		});

		mediaStream.webrtc.e.on("bye", function(event, reason, from) {
			//console.log("received bye", pickupTimeout, reason);
			switch (reason) {
				case "busy":
					console.log("User is busy", reason, from);
					$scope.$emit("notification", "busy", {
						reason: reason,
						from: from
					});
					break;
				case "reject":
					console.log("User rejected", reason, from);
					$scope.$emit("notification", "reject", {
						reason: reason,
						from: from
					});
					break;
				case "pickuptimeout":
					console.log("User did not pick up", reason, from);
					$scope.$emit("notification", "pickuptimeout", {
						reason: reason,
						from: from
					});
					break;
				case "error":
					console.log("User cannot accept call because of error");
					alertify.dialog.alert(translation._("Oops") + "<br/>" + translation._("User hung up because of error."));
					break;
				case "abort":
					console.log("Remote call was aborted before we did pick up");
					$scope.$emit("notification", "abortbeforepickup", {
						reason: reason,
						from: from
					});
					break;
			}
		});

		$scope.$on("status", function(event, status) {
			if (status === "connecting" && dialerEnabled) {
				dialer.start();
				// Start accept timeout.
				ringerTimeout = $timeout(function() {
					console.log("Ringer timeout reached.");
					mediaStream.webrtc.doHangup("ringertimeout");
					$scope.$emit("notification", "pickuptimeout", {
						reason: 'pickuptimeout',
						from: $scope.dialing
					});
				}, 35000);
			} else {
				dialer.stop();
				$timeout.cancel(ringerTimeout);
				ringerTimeout = null;
			}
			safeApply($scope, function(scope) {
				var old = $scope.status;
				$scope.status = status;
				if (old === "connected" && status === "waiting") {
					_.delay(playSound.play, 100, "end");
				} else if (old === "connecting" && status === "connected") {
					playSound.play("connect");
				}
			});
			appData.e.triggerHandler("mainStatus", [status]);
		});

		$scope.$on("notification", function(event, type, details) {
			var message = null;
			switch (type) {
				case "busy":
					message = displayName(details.from) + translation._(" is busy. Try again later.");
					break;
				case "reject":
					message = displayName(details.from) + translation._(" rejected your call.");
					break;
				case "pickuptimeout":
					message = displayName(details.from) + translation._(" does not pick up.");
					break;
				case "incomingbusy":
					toastr.info(moment().format("lll"), displayName(details.from) + translation._(" tried to call you"));
					break;
				case "abortbeforepickup":
					// Fall through
				case "incomingpickuptimeout":
					toastr.info(moment().format("lll"), displayName(details.from) + translation._(" called you"));
					break;
			}
			if (message) {
				playSound.play("question");
				alertify.dialog.alert(message);
			}
			appData.e.triggerHandler("uiNotification", [type, details]);
		});

		$scope.$on("download", function(event, from, token) {

			var scope = event.targetScope;
			fileDownload.startDownload(scope, from, token);

		});

		var chatMessagesUnseen = {};
		$scope.$on("chatincoming", function(event, id) {
			var count = chatMessagesUnseen[id] || 0;
			count++;
			chatMessagesUnseen[id] = count;
			$scope.chatMessagesUnseen++;
		});

		$scope.$on("chatseen", function(event, id) {
			var count = chatMessagesUnseen[id] || 0;
			delete chatMessagesUnseen[id];
			$scope.chatMessagesUnseen = $scope.chatMessagesUnseen - count;
		});

		_.defer(function() {
			if (!$window.webrtcDetectedVersion || $window.webrtcDetectedBrowser === "edge") {
				alertify.dialog.custom("webrtcUnsupported");
				return;
			}
			if (!Modernizr.websockets || $window.webrtcDetectedVersion < $window.webrtcMinimumVersion) {
				alertify.dialog.alert(translation._("Your browser is not supported. Please upgrade to a current version."));
				$scope.setStatus("unsupported");
				return;
			}
			if (mediaStream.config.Renegotiation && $window.webrtcDetectedBrowser === "firefox" && $window.webrtcDetectedVersion < 38) {
				// See https://bugzilla.mozilla.org/show_bug.cgi?id=1017888
				// and https://bugzilla.mozilla.org/show_bug.cgi?id=840728
				// and https://bugzilla.mozilla.org/show_bug.cgi?id=842455
				// XXX(longsleep): It seems that firefox has implemented new API which
				// supports addTrack, removeTrack see http://w3c.github.io/mediacapture-main/#dom-mediastream-removetrack
				console.warn("Renegotiation enabled -> currently not compatible with Firefox.");
				return;
			}
		});

	}];

});
