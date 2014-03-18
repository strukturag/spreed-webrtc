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
define(['underscore', 'text!partials/chat.html', 'text!partials/chatroom.html'], function(_, templateChat, templateChatroom) {

    return ["$compile", "safeDisplayName", "mediaStream", "safeApply", "desktopNotify", "translation", "playSound", "fileUpload", "randomGen", "buddyData", "$timeout", function($compile, safeDisplayName, mediaStream, safeApply, desktopNotify, translation, playSound, fileUpload, randomGen, buddyData, $timeout) {

        var displayName = safeDisplayName;
        var group_chat_id = "";

        var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

            $scope.layout.chat = false;

            var rooms = {};

            mediaStream.api.e.on("received.chat", function(event, id, from, data, p2p) {

                //console.log("received", data, id, from);

                var with_message = !!data.Message;

                if (!with_message && !rooms[from] && !rooms[id]) {
                    // Ignore empty messages for non existing rooms.
                    return;
                }

                var room = rooms[id];
                if (!room) {
                    // No room with this id, get one with the from id
                    $scope.$emit("startchat", from, {restore: with_message});
                    room = rooms[from];
                }

                if (with_message && from !== $scope.$parent.id) {
                    room.newmessage = true;
                    room.peerIsTyping = "no";
                    room.p2p(!!p2p);
                }
                //console.log("room", room);

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
                            room.$broadcast("received", data.Id, {Type: "LeftOrJoined", "LeftOrJoined": "left"});
                            safeApply(room);
                        }
                        break;
                    case "Joined":
                        if (!room.enabled) {
                            room.enabled = true;
                            _.delay(function() {
                                room.$broadcast("received", data.Id, {Type: "LeftOrJoined", "LeftOrJoined": "joined"});
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
                $scope.showRoom(id, {title: translation._("Chat with")}, options);

            });

            // Shared data;
            return {
                rooms: rooms,
                visibleRooms: []
            }


        }];

        var compile = function(tElement, tAttrs) {

            var chat = $compile(templateChatroom);
            return function(scope, iElement, iAttrs, controller) {
                scope.currentRoom = null;
                scope.showRoom = function(id, settings, options) {
                    var options = $.extend({}, options);
                    var subscope = controller.rooms[id];
                    var index = controller.visibleRooms.length;
                    if (!subscope) {
                        console.log("Create new chatroom", id);
                        controller.visibleRooms.push(id);
                        subscope = controller.rooms[id] = scope.$new(true);
                        translation.inject(subscope);
                        subscope.id = id;
                        subscope.isgroupchat = id === group_chat_id ? true : false;
                        subscope.index = index;
                        subscope.settings = settings;
                        subscope.visible = false;
                        subscope.newmessage = false;
                        subscope.enabled = true;
                        subscope.peerIsTyping = "no";
                        subscope.firstmessage = true;
                        subscope.p2pstate = false;
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
                            scope.$emit("chatseen");
                            if (subscope.newmessage) {
                                subscope.newmessage = false;
                                subscope.$broadcast("seen");
                            }
                        };
                        subscope.toggleMax = function() {
                            scope.toggleMax();
                        };
                        subscope.sendChat = function(to, message, status, mid, noloop) {
                            //console.log("send chat", to, scope.peer);
                            var peercall = mediaStream.webrtc.findTargetCall(to);
                            if (message && !mid) {
                                mid = randomGen.random({hex: true});
                            };
                            if (peercall && peercall.peerconnection.datachannelReady) {
                                subscope.p2p(true);
                                // Send out stuff through data channel.
                                _.delay(function() {
                                    mediaStream.api.apply("sendChat", {
                                        send: function(type, data) {
                                            // We also send to self, to display our own stuff.
                                            if (!noloop) {
                                                mediaStream.api.received({Type: data.Type, Data: data, From: mediaStream.api.id, To: peercall.id});
                                            }
                                            return peercall.peerconnection.send(data);
                                        }
                                    })(to, message, status, mid);
                                }, 100);

                            } else {
                                subscope.p2p(false);
                                _.delay(function() {
                                    mediaStream.api.send2("sendChat", function(type, data) {
                                        if (!noloop) {
                                            //console.log("looped to self", type, data);
                                            mediaStream.api.received({Type: data.Type, Data: data, From: mediaStream.api.id, To: to});
                                        }
                                    })(to, message, status, mid);
                                }, 100);
                            }
                            return mid;
                        };
                        subscope.p2p = function(state) {
                            if (state !== subscope.p2pstate) {
                                subscope.p2pstate = state;
                                subscope.$broadcast("p2p", state);
                            }
                        };
                        //console.log("Creating new chat room", controller, subscope, index);
                        subscope.$on("submit", function(event, input) {
                            subscope.seen();
                            var mid = subscope.sendChat(event.targetScope.id, input);
                            event.targetScope.$broadcast("received", null, {Type: "Message", Status: {State: "sent", "Mid": mid}});
                        });
                        subscope.$on("submitseen", function(event, pending) {
                            //console.log("submitseen", pending);
                            subscope.sendChat(event.targetScope.id, null, {SeenMids: pending}, null, true);
                        });
                        subscope.$on("submitreceived", function(event, mid) {
                            subscope.sendChat(event.targetScope.id, null, {State: "delivered", Mid: mid}, null, true);
                        });
                        subscope.$on("typing", function(event, params) {
                            if (params.who === "local") {
                                var room = event.targetScope.id;
                                subscope.seen();
                                //console.log("typing event", params.status);
                                if (!subscope.isgroupchat) {
                                    // Transmit typing events to private chats.
                                    subscope.sendChat(event.targetScope.id, null, {Typing: params.status});
                                }
                            } else {
                                subscope.peerIsTyping = params.status;
                                //console.log("peer typing event", params.status, subscope.peerIsTyping);
                            }
                            safeApply(subscope);
                        });
                        subscope.$on("incoming", function(event, message, from, userid) {
                            scope.$emit("chatincoming");
                            if (subscope.firstmessage || !desktopNotify.windowHasFocus) {
                                var room = event.targetScope.id;
                                // Make sure we are not in group chat or the message is from ourselves
                                // before we beep and shout.
                                if (!subscope.isgroupchat && from !== userid) {
                                    playSound.play("message1");
                                    desktopNotify.notify(translation._("Message from ")+displayName(from), message);
                                }
                                subscope.firstmessage = false;
                            }
                        });
                        chat(subscope, function(clonedElement, $scope) {

                            iElement.append(clonedElement);
                            $scope.element=clonedElement;
                            $scope.visible = true;
                            if (options.autofocus) {
                                _.defer(function() {
                                    $scope.$broadcast("focus");
                                });
                            }

                            // Support drag and drop file uploads in Chat.
                            var namespace = "file_"+scope.id;
                            var binder = fileUpload.bindDrop(namespace, clonedElement, _.bind(function(files) {
                                console.log("File dragged", files);
                                _.each(files, _.bind(function(f) {
                                    var info = $.extend({id: f.id}, f.info);
                                    console.log("Advertising file", f, info);
                                    $scope.sendChat(subscope.id, "File", {FileInfo: info});
                                }, this));
                            }, this));
                            binder.namespace = function() {
                                // Inject own id into namespace.
                                return namespace+"_"+scope.myid;
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
                    if (scope.currentRoom !== subscope && scope.currentRoom) {
                        scope.currentRoom.hide();
                    }

                    if (options.restore && !options.noenable) {
                        if (!scope.layout.chat) {
                            scope.layout.chat = true;
                        }
                    }

                    scope.currentRoom = subscope;
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
                    subscope.visible=false;
                    subscope.firstmessage=true;
                    // Refresh index of the rest of the rooms.
                    _.each(controller.visibleRooms, function(id, idx) {
                        var s = controller.rooms[id];
                        //console.log("updated idx", idx, s.index);
                        s.index = idx;
                    });
                    if (scope.currentRoom === subscope) {
                        scope.currentRoom = null;
                    }
                    if (!controller.visibleRooms.length) {
                        scope.showRoom(group_chat_id, {title: translation._("Group chat")}, {restore: true, noenable: true});
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
                    //TODO(longsleep): Angularize this.
                    iElement.parent().toggleClass("maximized");
                };

                scope.$on("room", function(event, room) {
                    if (room !== null) {
                        scope.showRoom(group_chat_id, {title: translation._("Group chat")}, {restore: true, noenable: true});
                    } else {
                        scope.hideRoom(group_chat_id);
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
