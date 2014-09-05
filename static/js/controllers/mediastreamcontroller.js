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
define(['underscore', 'bigscreen', 'moment', 'sjcl', 'modernizr', 'webrtc.adapter'], function(_, BigScreen, moment, sjcl, Modernizr) {

	return ["$scope", "$rootScope", "$element", "$window", "$timeout", "safeDisplayName", "safeApply", "mediaStream", "appData", "playSound", "desktopNotify", "alertify", "toastr", "translation", "fileDownload", "localStorage", "screensharing", "userSettingsData", "localStatus", "dialogs", function($scope, $rootScope, $element, $window, $timeout, safeDisplayName, safeApply, mediaStream, appData, playSound, desktopNotify, alertify, toastr, translation, fileDownload, localStorage, screensharing, userSettingsData, localStatus, dialogs) {

		/*console.log("route", $route, $routeParams, $location);*/

		// Disable drag and drop.
		$($window).on("dragover dragenter drop", function(event) {
			event.preventDefault();
		});

		// Avoid accidential reloads or exits when in a call.
		var manualUnload = false;
		$($window).on("beforeunload", function(event) {
			if (manualUnload || !$scope.peer) {
				return;
			}
			return translation._("Close this window and disconnect?");
		});

		// Enable app full screen listener.
		$("#bar .logo").on("doubletap dblclick", _.debounce(function() {
			if (BigScreen.enabled) {
				BigScreen.toggle($("body").get(0));
			}
		}, 100, true));

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
			"prompt": "question1"
		});

		appData.set($scope);

		var videoQualityMap = {
			low: {
				maxWidth: 320,
				maxHeight: 180
			},
			high: {
				maxWidth: 640,
				maxHeight: 360
			},
			hd: {
				minWidth: 1280,
				minHeight: 720
			},
			fullhd: {
				minWidth: 1920,
				minHeight: 1080
			}
		}

		var displayName = safeDisplayName;

		// Init STUN and TURN servers.
		$scope.stun = mediaStream.config.StunURIs || [];
		if (!$scope.stun.length) {
			$scope.stun.push("stun:stun.l.google.com:19302")
		}
		$scope.turn = {}; // TURN servers are set on received.self.

		// Add browser details for easy access.
		$scope.isChrome = $window.webrtcDetectedBrowser === "chrome";
		$scope.webrtcDetectedBrowser = $window.webrtcDetectedBrowser;
		$scope.webrtcDetectedVersion = $window.webrtcDetectedVersion;

		// Add support status.
		$scope.supported = {
			screensharing: screensharing.supported
		}

		// Default scope data.
		$scope.status = "initializing";
		$scope.id = $scope.myid = null;
		$scope.userid = $scope.myuserid = null;
		$scope.suserid = null;
		$scope.peer = null;
		$scope.dialing = null;
		$scope.conference = null;
		$scope.conferencePeers = [];
		$scope.incoming = null;
		$scope.microphoneMute = false;
		$scope.cameraMute = false;
		$scope.layout = {
			main: null
		};
		$scope.chatMessagesUnseen = 0;
		$scope.autoAccept = null;
		$scope.isCollapsed = true;
		$scope.defaults = {
			displayName: null,
			buddyPicture: null,
			message: null,
			settings: {
				videoQuality: "high",
				stereo: true,
				maxFrameRate: 20,
				defaultRoom: "",
				language: ""
			}
		};
		$scope.master = angular.copy($scope.defaults);

		// Data voids.
		var resurrect = null;
		var reconnecting = false;
		var connected = false;
		var autoreconnect = true;

		$scope.update = function(user) {
			$scope.master = angular.copy(user);
			if (connected) {
				$scope.updateStatus();
			}
			$scope.refreshWebrtcSettings();
		};

		$scope.reset = function() {
			$scope.user = angular.copy($scope.master);
		};
		$scope.reset(); // Call once for bootstrap.

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

		$scope.refreshWebrtcSettings = function() {

			if (!$window.webrtcDetectedBrowser) {
				console.warn("This is not a WebRTC capable browser.");
				return;
			}
			var settings = $scope.master.settings;

			// Create iceServers from scope settings.
			var iceServers = [];
			var iceServer;
			if ($scope.stun.length) {
				iceServer = createIceServers($scope.stun);
				if (iceServer.length) {
					iceServers.push.apply(iceServers, iceServer);
				}
			}
			if ($scope.turn.urls && $scope.turn.urls.length) {
				iceServer = createIceServers($scope.turn.urls, $scope.turn.username, $scope.turn.password);
				if (iceServer.length) {
					iceServers.push.apply(iceServers, iceServer);
				}
			}

			var audioConstraints = [];
			var videoConstraints = [];
			var videoConstraintsMandatory = {};

			// Chrome only constraints.
			if ($scope.isChrome) {
				// Video.
				videoConstraintsMandatory = $.extend(videoConstraintsMandatory, videoQualityMap[settings.videoQuality]);
				// Not supported as of Firefox 27.
				if (settings.microphoneId) {
					audioConstraints.push({
						sourceId: settings.microphoneId
					});
				}
				// Not supported as of Firefox 27.
				if (settings.cameraId) {
					videoConstraints.push({
						sourceId: settings.cameraId
					});
				}
				// Not supported as of Firefox 27.
				if (settings.maxFrameRate && settings.maxFrameRate != "auto") {
					videoConstraintsMandatory.maxFrameRate = parseInt(settings.maxFrameRate, 10);
				}
			}

			// Apply the shit.
			mediaStream.webrtc.settings.stereo = settings.stereo;
			mediaStream.webrtc.settings.mediaConstraints.video.mandatory = videoConstraintsMandatory;
			mediaStream.webrtc.settings.mediaConstraints.video.optional = videoConstraints;
			mediaStream.webrtc.settings.mediaConstraints.audio = {
				optional: audioConstraints
			};
			mediaStream.webrtc.settings.pcConfig.iceServers = iceServers;

			// Inject optional stuff.
			var optionalPcConstraints = mediaStream.webrtc.settings.pcConstraints.optional = [];
			if ($window.webrtcDetectedBrowser === "chrome") {
				// NOTE(longsleep): We can always enable SCTP data channels, as we have a workaround
				// using the "active" event for Firefox < 27.
				// SCTP does not work correctly with Chrome 31. Require M32.
				if ($window.webrtcDetectedVersion >= 32) {
					// SCTP is supported from Chrome M31.
					// No need to pass DTLS constraint as it is on by default in Chrome M31.
					// For SCTP, reliable and ordered is true by default.
				} else {
					// Chrome < M32 does not yet do DTLS-SRTP by default whereas Firefox only
					// does DTLS-SRTP. In order to get interop, you must supply Chrome
					// with a PC constructor constraint to enable DTLS.
					console.warn("Turning on SCTP combatibility - please update your Chrome.");
					optionalPcConstraints.push({
						DtlsSrtpKeyAgreement: true
					});
				}
			}

			//console.log("WebRTC settings", mediaStream.webrtc.settings);

		};
		$scope.refreshWebrtcSettings(); // Call once for bootstrap.

		var pickupTimeout = null;
		var autoAcceptTimeout = null;
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

		$scope.manualReloadApp = function(url) {
			manualUnload = true;
			if (url) {
				$window.location.href = url;
				$timeout(function() {
					manualUnload = false;
				}, 0);
			} else {
				$window.location.reload(true);
			}
		};

		$scope.loadUserSettings = function() {
			$scope.master = angular.copy($scope.defaults);
			var storedUser = userSettingsData.load();
			if (storedUser) {
				$scope.user = $.extend(true, {}, $scope.master, storedUser);
				$scope.user.settings = $.extend(true, {}, $scope.user.settings, $scope.master.settings, $scope.user.settings);
				$scope.update($scope.user);
				$scope.loadedUser = storedUser.displayName && true;
			} else {
				$scope.loadedUser = false;
			}
			$scope.reset();
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
				scope.turn = data.Turn;
				scope.stun = data.Stun;
				scope.refreshWebrtcSettings();
			});
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
			if (resurrect) {
				var resurrection = resurrect;
				resurrect = null;
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

			if (!$rootScope.roomid && $scope.user.settings.defaultRoom) {
				console.log("Selecting user based default room:", [$scope.user.settings.defaultRoom]);
				mediaStream.changeRoom($scope.user.settings.defaultRoom, true);
			}

			// Unmark authorization process.
			if (data.Userid) {
				mediaStream.users.authorizing(false);
			} else if (!mediaStream.users.authorizing()) {
				// Trigger user data load when not in authorizing phase.
				$scope.loadUserSettings();
			}

			// Always apply room after self received to avoid double stuff.
			mediaStream.applyRoom();

		});

		mediaStream.webrtc.e.on("peercall", function(event, peercall) {

			// Kill timeout.
			$timeout.cancel(pickupTimeout);
			pickupTimeout = null;
			// Kill ringer.
			if (peercall && peercall.from === null) {
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
			});
		});

		mediaStream.webrtc.e.on("peerconference", function(event, peerconference) {
			safeApply($scope, function(scope) {
				scope.conference = peerconference ? peerconference.id : null;
				scope.conferencePeers = peerconference ? peerconference.peerIds() : [];
			});
		});

		mediaStream.webrtc.e.on("offer", function(event, from, to2, to) {
			safeApply($scope, function(scope) {
				scope.incoming = from;
			});
			if ($scope.updateAutoAccept(null, from)) {
				// Auto accept support.
				mediaStream.webrtc.doAccept();
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
				mediaStream.webrtc.doHangup("pickuptimeout");
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

		var reconnect = function() {
			if (connected && autoreconnect) {
				if (resurrect === null) {
					// Storage data at the resurrection shrine.
					resurrect = {
						status: $scope.getStatus(),
						id: $scope.id
					}
					console.log("Stored data at the resurrection shrine", resurrect);
				}
				reconnecting = false;
				_.delay(function() {
					if (autoreconnect && !reconnecting) {
						reconnecting = true;
						console.log("Requesting to reconnect ...");
						mediaStream.reconnect();
					}
				}, 500);
				$scope.setStatus("reconnecting");
			} else {
				$scope.setStatus("closed");
			}
		};

		mediaStream.connector.e.on("open error close", function(event, options) {
			var t = event.type;
			var opts = $.extend({}, options);
			$timeout.cancel(ttlTimeout);
			if (!opts.soft) {
				// Reset login information for anything not soft.
				$scope.userid = $scope.suserid = null;
			}
			switch (t) {
				case "open":
					t = "waiting";
					connected = true;
					reconnecting = false;
					$scope.updateStatus(true);
					if (opts.soft) {
						return;
					}
					break;
				case "error":
					if (reconnecting || connected) {
						reconnecting = false;
						reconnect();
						return;
					}
					break;
				case "close":
					reconnect();
					return;
			}
			$scope.setStatus(t);
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
				case "completed":
				case "connected":
					if ($scope.conference) {
						$scope.setStatus('conference');
					} else {
						$scope.setStatus('connected');
					}
					break;
				case "failed":
					mediaStream.webrtc.doHangup();
					alertify.dialog.alert(translation._("Peer connection failed. Check your settings."));
					break;
			}
		});

		$scope.$on("active", function(event, currentcall) {

			console.info("Video state active (assuming connected)", currentcall.id);
			if ($scope.conference) {
				$scope.setStatus('conference');
			} else {
				$scope.setStatus('connected');
			}
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

		// Apply all layout stuff as classes to our element.
		$scope.$watch("layout", (function() {
			var makeName = function(prefix, n) {
				return prefix + n.substr(0, 1).toUpperCase() + n.substr(1);
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

		mediaStream.webrtc.e.on("done", function() {
			if (mediaStream.connector.connected) {
				$scope.setStatus("waiting");
			}
			if ($scope.roomstatus) {
				$scope.layout.buddylist = true;
				$scope.layout.buddylistAutoHide = false;
			} else {
				$scope.layout.buddylist = false;
				$scope.layout.buddylistAutoHide = true;
			}
		});

		$scope.$watch("roomstatus", function(roomstatus) {
			if (roomstatus && !$scope.peer) {
				$scope.layout.buddylist = true;
				$scope.layout.buddylistAutoHide = false;
			} else if (!$scope.layout.buddylistAutoHide) {
				$scope.layout.buddylist = false;
				$scope.layout.buddylistAutoHide = true;
			}
		});

		mediaStream.webrtc.e.on("busy", function(event, from) {
			console.log("Incoming call - sent busy.", from);
			$scope.$emit("notification", "incomingbusy", {
				reason: 'busy',
				from: from
			});
		});

		mediaStream.webrtc.e.on("bye", function(event, reason, from) {
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
			}
		});

		$scope.$on("status", function(event, status) {
			if (status === "connecting" && dialerEnabled) {
				dialer.start();
			} else {
				dialer.stop();
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
					toastr.info(moment().format("llll"), displayName(details.from) + translation._(" tried to call you."));
					break;
				case "incomingpickuptimeout":
					toastr.info(moment().format("llll"), displayName(details.from) + translation._(" called you."));
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
			if (!Modernizr.websockets) {
				alertify.dialog.alert(translation._("Your browser is not supported. Please upgrade to a current version."));
				$scope.setStatus("unsupported");
				return;
			}
			if (!$window.webrtcDetectedVersion) {
				alertify.dialog.alert(translation._("Your browser does not support WebRTC. No calls possible."));
				return;
			}
		});

	}];

});
