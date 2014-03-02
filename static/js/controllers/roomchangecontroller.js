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
define([], function() {

    // RoomchangeController
    return ["$scope", "$element", "$window", "$location", "mediaStream", "$http", "$timeout", function($scope, $element, $window, $location, mediaStream, $http, $timeout) {

        console.log("Room change controller", $element, $scope.roomdata);

        var baseurl = $window.location.protocol+'//'+$window.location.host+mediaStream.config.B;
        var url = (mediaStream.config.B || "/") + "api/v1/rooms";

        var ctrl = this;
        ctrl.enabled = true;
        ctrl.getRoom = function(cb) {
            $http({
                method: "POST",
                url: url,
                data: $.param({
                }),
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            }).
            success(function(data, status) {
                cb(data);
            }).
            error(function() {
                console.log("Failed to retrieve room link", arguments);
                cb(data);
            });
        };

        $scope.changeRoomToId = function(id) {
            var roomid = $window.encodeURIComponent(id);
            $location.path("/"+roomid);
            return roomid;
        };

        $scope.$on("$destroy", function() {
            //console.log("Room change controller destroyed");
            ctrl.enabled = false;
        });

        if (typeof $scope.roomdata !== "undefined") {
            $scope.roomdata = {};
            $timeout(function() {
                if (ctrl.enabled) {
                    ctrl.getRoom(function(roomdata) {
                        console.info("Retrieved room data", roomdata);
                        $scope.roomdata = roomdata;
                        roomdata.link = baseurl + encodeURI(roomdata.name);
                    });
                }
            }, 500);
        }

    }];

});
