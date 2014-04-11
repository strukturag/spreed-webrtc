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
define([
    'jquery',
    'underscore',
    'mediastream/connector',
    'mediastream/api',
    'mediastream/webrtc',
    'mediastream/tokens'

], function($, _, Connector, Api, WebRTC, tokens) {

    return ["globalContext", "$route", "$location", "$window", "visibility", "alertify", "$http", "safeApply", "$timeout", "$sce", function(context, $route, $location, $window, visibility, alertify, $http, safeApply, $timeout, $sce) {

        var url = (context.Ssl ? "wss" : "ws") + "://" + context.Host + (context.Cfg.B || "/") + "ws";
        var version = context.Cfg.Version || "unknown";
        console.log("Service version: "+version);
        console.log("Ws URL: "+ url);
        console.log("Secure Contextual Escaping: "+$sce.isEnabled());

        var connector = new Connector(version);
        var api = new Api(connector);
        var webrtc = new WebRTC(api);

        var td = null;
        $window.testDisconnect = function() {
            if (td) {
                $window.clearInterval(td);
                td = null;
                console.info("Stopped disconnector.");
                return;
            }
            td = $window.setInterval(function() {
                console.info("Test disconnect!");
                connector.conn.close();
            }, 10000);
            console.info("Started disconnector.");
        };

        var mediaStream = {
            version: version,
            ws: url,
            config: context.Cfg,
            webrtc: webrtc,
            connector: connector,
            api: api,
            tokens: tokens,
            url: {
                room: function(id) {
                    id = $window.encodeURIComponent(id);
                    return $window.location.protocol+'//'+$window.location.host+context.Cfg.B+id;
                },
                api: function(path) {
                    return (context.Cfg.B || "/") + "api/v1/" + path;
                }
            },
            initialize: function($rootScope, translation) {

                var cont = false;
                var ready = false;

                $rootScope.version = version;
                $rootScope.roomid = null;
                $rootScope.roomlink = null;
                $rootScope.roomstatus = false;

                var connect = function() {
                    if (ready && cont) {
                        // Inject connector function into scope, so that controllers can pick it up.
                        safeApply($rootScope, function(scope) {
                            scope.connect = function() {
                                connector.connect(url);
                            };
                        });
                    }
                };

                $window.changeRoom = function(room) {
                    $rootScope.$apply(function(scope) {
                        $location.path("/"+room).replace();
                    });
                };

                var title = (function(e) {
                    return {
                        element: e,
                        text: e.text()
                    }
                }($("title")));

                // Room selector.
                $rootScope.$on("$locationChangeSuccess", function(event) {
                    //console.log("location change", $route, $rootScope.roomid);
                    var defaultRoom, room;
                    room = defaultRoom = $rootScope.roomid || "";
                    if ($route.current) {
                        room = $route.current.params.room;
                    } else {
                        room = "";
                    }
                    if (!ready && room !== defaultRoom && !room) {
                        // First start.
                        $location.path("/"+defaultRoom).replace();
                        return
                    }
                    console.info("Selected room is:", [room]);
                    if (!ready || !cont) {
                        ready = true;
                        connector.roomid = room;
                        connect();
                    } else {
                        connector.room(room);
                    }
                    $rootScope.roomid = room;
                    $rootScope.roomlink = room ? mediaStream.url.room(room) : null;

                    if ($rootScope.roomlink) {
                        title.element.text(room + " - " + title.text);
                    } else {
                        title.element.text(title.text);
                    }

                });

                // Cache events, to avoid ui flicker during quick room changes.
                var roomStatusCache = $rootScope.roomstatus;
                var roomCache = null;
                var roomCache2 = null;
                $rootScope.$on("roomStatus", function(event, status) {
                    roomStatusCache = status ? true : false;
                    roomCache = status ? $rootScope.roomid : null;
                    $timeout(function() {
                        if ($rootScope.roomstatus !== roomStatusCache) {
                            $rootScope.roomstatus = roomStatusCache;
                        }
                        if (roomCache !== roomCache2) {
                            $rootScope.$broadcast("room", roomCache);
                            roomCache2 = roomCache;
                        }
                    }, 100);
                });

                visibility.afterPrerendering(function() {

                    // Hide loader when we are visible.
                    var loader = $("#loader");
                    loader.addClass("done");
                    _.delay(function() {
                        loader.remove();
                    },1000);

                    if (context.Cfg.Tokens) {
                        var storedCode = localStorage.getItem("mediastream-access-code");
                        var prompt = function() {
                            alertify.dialog.prompt(translation._("Access code required"), function(code) {
                                if (!code) {
                                    prompt();
                                } else {
                                    check(code);
                                    return;
                                }
                            }, prompt);
                        };
                        var url = mediaStream.url.api("tokens");
                        var check = function(code) {
                            $http({
                                method: "POST",
                                url: url,
                                data: $.param({
                                    a: code
                                }),
                                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
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
                            error(function() {
                                alertify.dialog.error(translation._("Error"), translation._("Failed to verify access code. Check your Internet connection and try again."), function() {
                                    prompt();
                                });
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
