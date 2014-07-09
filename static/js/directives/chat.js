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
define(['underscore', 'text!partials/chat.html', 'text!partials/chatroom.html'], function(_, templateChat, templateChatroom) {

	return ["$compile", "safeDisplayName", "mediaStream", "safeApply", "desktopNotify", "translation", "playSound", "fileUpload", "randomGen", "buddyData", "appData", "$timeout", function($compile, safeDisplayName, mediaStream, safeApply, desktopNotify, translation, playSound, fileUpload, randomGen, buddyData, appData, $timeout) {

		var displayName = safeDisplayName;
		var group_chat_id = "";

		var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

			$scope.layout.chat = false;
			$scope.layout.chatMaximized = false;

			var ctrl = this;
			var rooms = ctrl.rooms = {};
			ctrl.visibleRooms = [];
			ctrl.group = group_chat_id;
			ctrl.get = function(id) {
				return ctrl.rooms[id];
			}

			$scope.currentRoom = null;
			$scope.currentRoomActive = false;
			$scope.getVisibleRooms = function() {
				var res = [];
				for (var i = 0; i < ctrl.visibleRooms.length; i++) {
					var r = rooms[ctrl.visibleRooms[i]];
					if (!r || r.id === ctrl.group) {
						continue;
					}
					res.push(r);
				}
				return res;
			};
			$scope.getGroupRoom = function() {
				return rooms[ctrl.group];
			};

			mediaStream.api.e.on("received.chat", function(event, id, from, data, p2p) {

				//console.log("received", data, id, from);

				var roomid = id;
				if (roomid === mediaStream.api.id) {
					roomid = from;
				} else {
					if (roomid !== ctrl.group && from !== mediaStream.api.id) {
						console.log("Received chat message for invalid room", roomid, id, from);
						return;
					}
				}

				var with_message = !! data.Message;
				var room = rooms[roomid];
				if (!room) {
					if (!with_message) {
						return;
					}
					// No room with this id, get one with the from id
					$scope.$emit("startchat", from, {
						restore: with_message
					});
					room = rooms[from];
				}

				if (with_message && from !== mediaStream.api.id) {
					room.newmessage = true;
					room.peerIsTyping = "no";
					room.p2p( !! p2p);
				}

				room.$broadcast("received", from, data);
				safeApply(room);

			});

			mediaStream.api.e.on("received.userleftorjoined", function(event, dataType, data) {
				var room = rooms[data.Id];
				if (room) {
					switch (dataType) {
						case "Left":
							if (data.Status !== "soft") {
								room.enabled = false;
								room.$broadcast("received", data.Id, {
									Type: "LeftOrJoined",
									"LeftOrJoined": "left"
								});
								safeApply(room);
							}
							break;
						case "Joined":
							if (!room.enabled) {
								room.enabled = true;
								_.delay(function() {
									room.$broadcast("received", data.Id, {
										Type: "LeftOrJoined",
										"LeftOrJoined": "joined"
									});
									safeApply(room);
								}, 1000);
							}
							break;
						default:
							break;
					}
				}
			});

			$scope.$parent.$on("startchat", function(event, id, options) {

				//console.log("startchat requested", event, id);
				if (id === group_chat_id) {
					$scope.showGroupRoom(null, options);
				} else {
					$scope.showRoom(id, {
						title: translation._("Chat with")
					}, options);
				}

			});

			$scope.$parent.$on("requestcontact", function(event, id, options) {

				if (id !== group_chat_id) {
					// Make sure the contact id is valid.
					var ad = appData.get();
					if (!ad.userid) {
						// Unable to add contacts as we have no own userid.
						console.log("You need to log in to add contacts.");
						return;
					}
					var bd = buddyData.get(id);
					if (!bd || !bd.session || !bd.session.Userid || ad.userid === bd.session.Userid) {
						console.log("This contact cannot be added.");
						return;
					}
					var subscope = $scope.showRoom(id, {
						title: translation._("Chat with")
					}, options);
					subscope.sendChatServer(id, "Contact request", {
						ContactRequest: {
							Id: randomGen.random({hex: true})
						}
					});
				}

			});

		}];

		var compile = function(tElement, tAttrs) {

			var chat = $compile(templateChatroom);
			return function(scope, iElement, iAttrs, controller) {

				var pane = iElement.find(".chatpane");

				scope.showGroupRoom = function(settings, options) {
					var stngs = $.extend({
						title: translation._("Room chat")
					}, settings);
					return scope.showRoom(controller.group, stngs, options);
				};

				scope.showRoom = function(id, settings, opts) {
					var options = $.extend({}, opts);
					var subscope = controller.rooms[id];
					var index = controller.visibleRooms.length;
					if (!subscope) {
						console.log("Create new chatroom", [id]);
						controller.visibleRooms.push(id);
						subscope = controller.rooms[id] = scope.$new();
						translation.inject(subscope);
						subscope.id = id;
						subscope.isgroupchat = id === controller.group ? true : false;
						subscope.index = index;
						subscope.settings = settings;
						subscope.visible = false;
						subscope.newmessage = false;
						subscope.enabled = true;
						subscope.peerIsTyping = "no";
						subscope.firstmessage = true;
						subscope.p2pstate = false;
						subscope.active = false;
						subscope.pending = 0;
						if (!subscope.isgroupchat) {
							buddyData.push(id);
						}
						subscope.hide = function() {
							scope.hideRoom(id);
						};
						//TODO(longsleep): This is currently never called. Find a suitable way to clean up old chats.
						subscope.kill = function() {
							if (!subscope.isgroupchat) {
								buddyData.pop(id);
							}
							scope.killRoom(id);
						};
						subscope.seen = function() {
							subscope.pending = 0;
							scope.$emit("chatseen", subscope.id);
							if (subscope.newmessage) {
								subscope.newmessage = false;
								subscope.$broadcast("seen");
							}
						};
						subscope.deactivate = function() {
							scope.deactivateRoom();
						};
						subscope.toggleMax = function() {
							scope.toggleMax();
						};
						subscope.sendChat = function(to, message, status, mid, noloop) {
							//console.log("send chat", to, scope.peer);
							var peercall = mediaStream.webrtc.findTargetCall(to);
							if (peercall && peercall.peerconnection.datachannelReady) {
								subscope.p2p(true);
								// Send out stuff through data channel.
								return subscope.sendChatPeer2Peer(peercall, to, message, status, mid, noloop);
							} else {
								subscope.p2p(false);
								return subscope.sendChatServer(to, message, status, mid, noloop);
							}
							return mid;
						};
						subscope.sendChatPeer2Peer = function(peercall, to, message, status, mid, noloop) {
							if (message && !mid) {
								mid = randomGen.random({
									hex: true
								});
							}
							_.delay(function() {
								mediaStream.api.apply("sendChat", {
									send: function(type, data) {
										// We also send to self, to display our own stuff.
										if (!noloop) {
											mediaStream.api.received({
												Type: data.Type,
												Data: data,
												From: mediaStream.api.id,
												To: peercall.id
											});
										}
										return peercall.peerconnection.send(data);
									}
								})(to, message, status, mid);
							}, 100);
							return mid;
						};
						subscope.sendChatServer = function(to, message, status, mid, noloop) {
							if (message && !mid) {
								mid = randomGen.random({
									hex: true
								});
							}
							_.delay(function() {
								mediaStream.api.send2("sendChat", function(type, data) {
									if (!noloop) {
										//console.log("looped to self", type, data);
										mediaStream.api.received({
											Type: data.Type,
											Data: data,
											From: mediaStream.api.id,
											To: to
										});
									}
								})(to, message, status, mid);
							}, 100);
							return mid;
						};
						subscope.p2p = function(state) {
							if (state !== subscope.p2pstate) {
								subscope.p2pstate = state;
								subscope.$broadcast("p2p", state);
							}
						};
						subscope.doCall = function() {
							mediaStream.webrtc.doCall(subscope.id);
						};
						subscope.doClear = function() {
							subscope.$broadcast("clear");
						};
						//console.log("Creating new chat room", controller, subscope, index);
						subscope.$on("submit", function(event, input) {
							subscope.seen();
							var mid = subscope.sendChat(event.targetScope.id, input);
							event.targetScope.$broadcast("received", null, {
								Type: "Message",
								Status: {
									State: "sent",
									"Mid": mid
								}
							});
						});
						subscope.$on("submitseen", function(event, pending) {
							//console.log("submitseen", pending);
							subscope.sendChat(event.targetScope.id, null, {
								SeenMids: pending
							}, null, true);
						});
						subscope.$on("submitreceived", function(event, mid) {
							subscope.sendChat(event.targetScope.id, null, {
								State: "delivered",
								Mid: mid
							}, null, true);
						});
						subscope.$on("typing", function(event, params) {
							if (params.who === "local") {
								var room = event.targetScope.id;
								subscope.seen();
								//console.log("typing event", params.status);
								if (!subscope.isgroupchat) {
									// Transmit typing events to private chats.
									subscope.sendChat(event.targetScope.id, null, {
										Typing: params.status
									});
								}
							} else {
								subscope.peerIsTyping = params.status;
								//console.log("peer typing event", params.status, subscope.peerIsTyping);
							}
							safeApply(subscope);
						});
						subscope.$on("incoming", function(event, message, from, sessionid) {
							if (from !== sessionid) {
								subscope.pending++;
								scope.$emit("chatincoming", subscope.id);
							}
							if (subscope.firstmessage || !desktopNotify.windowHasFocus) {
								var room = event.targetScope.id;
								// Make sure we are not in group chat or the message is from ourselves
								// before we beep and shout.
								if (!subscope.isgroupchat && from !== sessionid) {
									playSound.play("message1");
									desktopNotify.notify(translation._("Message from ") + displayName(from), message);
									appData.e.triggerHandler("uiNotification", ["chatmessage", {from: from, message: message, first: subscope.firstmessage}]);
								}
								subscope.firstmessage = false;
							} else {
								if (!subscope.isgroupchat && from !== sessionid) {
									appData.e.triggerHandler("uiNotification", ["chatmessage", {from: from, message: message, first: subscope.firstmessage}]);
								}
							}
						});
						chat(subscope, function(clonedElement, $scope) {

							pane.append(clonedElement);
							$scope.element = clonedElement;
							$scope.visible = true;
							if (options.autofocus) {
								_.defer(function() {
									$scope.$broadcast("focus");
								});
							}

							var sendFiles = function(files) {
								_.each(files, function(f) {
									var info = $.extend({
										id: f.id
									}, f.info);
									console.log("Advertising file", f, info);
									$scope.sendChat(subscope.id, "File", {
										FileInfo: info
									});
								});
							};

							// Support drag and drop file uploads in Chat.
							var namespace = "file_" + scope.id;
							var binderDrop = fileUpload.bindDrop(namespace, clonedElement, _.bind(function(files) {
								console.log("File dragged", files);
								sendFiles(files);
							}, this));
							var binderClick = fileUpload.bindClick(namespace, $(".btn-fileupload", clonedElement), _.bind(function(files) {
								console.log("Click found files", files);
								sendFiles(files);
							}, this));
							binderDrop.namespace = binderClick.namespace = function() {
								// Inject own id into namespace.
								return namespace + "_" + scope.myid;
							};

						});
					} else {

						if (options.restore) {
							if (!subscope.visible) {
								controller.visibleRooms.push(id);
								subscope.index = index;
								subscope.visible = true;
							}
						}
						if (options.autofocus && subscope.visible) {
							subscope.$broadcast("focus");
						}

					}

					if (!options.noactivate) {
						scope.activateRoom(subscope.id, true);
					}

					if (options.restore && !options.noenable) {
						if (!scope.layout.chat) {
							scope.layout.chat = true;
						}
					}

					safeApply(subscope);
					return subscope;
				};

				scope.hideRoom = function(id) {
					var subscope = controller.rooms[id];
					if (!subscope) {
						console.log("hideRoom called for unknown room", id);
						return;
					}
					var element = subscope.element;
					var index = subscope.index;
					controller.visibleRooms.splice(index, 1);
					subscope.visible = false;
					subscope.firstmessage = true;
					// Refresh index of the rest of the rooms.
					_.each(controller.visibleRooms, function(id, idx) {
						var s = controller.rooms[id];
						//console.log("updated idx", idx, s.index);
						s.index = idx;
					});
					if (scope.currentRoom === subscope) {
						scope.currentRoom = null;
						scope.currentRoomActive = false;
					}
					if (!controller.visibleRooms.length) {
						scope.showGroupRoom(null, {
							restore: true,
							noenable: true,
							noactivate: true
						});
						// If last visible room was removed, hide chat.
						scope.layout.chat = false;
					}
				};

				scope.killRoom = function(id) {
					scope.hideRoom(id);
					var subscope = controller.rooms[id];
					if (!subscope) {
						return;
					}
					delete controller.rooms[id];
					$timeout(function() {
						subscope.$destroy();
					}, 0);
				};

				scope.toggleMax = function() {
					scope.layout.chatMaximized = !scope.layout.chatMaximized;
				};

				scope.activateRoom = function(id, active) {
					var subscope = controller.rooms[id];
					if (!subscope) {
						return;
					}
					var visible = !! scope.layout.chat;
					var flip = false;
					//console.log("toggleActive", active, id, scope.currentRoom, scope.currentRoom == subscope, subscope.active);
					if (scope.currentRoom == subscope) {
						subscope.active = active;
						scope.currentRoomActive = true;
						if (visible) {
							flip = true;
						}
					} else {
						if (scope.currentRoom) {
							scope.currentRoom.active = false;
							//scope.currentRoom.hide();
							if (visible) {
								flip = true;
							}
						}
						if (active) {
							scope.currentRoom = subscope;
							scope.currentRoomActive = true;
						}
						subscope.active = active;
					}
					if (flip) {
						pane.toggleClass("flip");
					}
				};

				scope.deactivateRoom = function() {
					scope.currentRoomActive = false;
				};

				scope.$watch("layout.chat", function(chat) {
					if (!chat) {
						pane.removeClass("flip");
					}
					scope.layout.chatMaximized = false;
				});

				scope.$on("room", function(event, room) {
					var subscope = scope.showGroupRoom(null, {
						restore: true,
						noenable: true,
						noactivate: true
					});
					if (room) {
						var msg = $("<span>").text(translation._("You are now in room %s ...", room));
						subscope.$broadcast("display", null, $("<i>").append(msg));
					}
				});

			};

		};

		return {
			restrict: 'E',
			replace: true,
			scope: true,
			template: templateChat,
			controller: controller,
			compile: compile
		}

	}];

});
