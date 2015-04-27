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
(function () {

    var script = document.getElementsByTagName("script")[0];
    var PARENT_ORIGIN = script.getAttribute("data-parent-origin");

    var YouTubeSandbox = function(window) {
        this.head = document.getElementsByTagName('head')[0];
        this.window = window;
        this.addedIframeScript = false;
        this.player = null;
        this.seekDetector = null;
        this.prevTime = null;
        this.prevNow = null;
    };

    YouTubeSandbox.prototype.postMessage = function(type, message) {
        var msg = {"type": type};
        msg[type] = message;
        this.window.parent.postMessage(msg, PARENT_ORIGIN);
    };

    YouTubeSandbox.prototype.onYouTubeIframeAPIReady = function() {
        this.postMessage("youtube.apiReady", {"apiReady": true});
    };

    YouTubeSandbox.prototype.loadApi = function(url) {
        if (!this.addedIframeScript) {
            var that = this;
            var script = document.createElement('script');
            script.type = "text/javascript";
            script.src = url;
            script.onerror = function(evt) {
                that.postMessage("youtube.error", {"msgid": "loadScriptFailed"});
                that.head.removeChild(script);
                that.addedIframeScript = false;
            };
            this.head.appendChild(script);
            this.addedIframeScript = true;
        }
    };

    YouTubeSandbox.prototype.loadPlayer = function(params) {
        if (!this.player) {
            var that = this;
            var stateEvents = {
                "-1": "youtube.unstarted",
                "0": "youtube.ended",
                "1": "youtube.playing",
                "2": "youtube.paused",
                "3": "youtube.buffering",
                "5": "youtube.videocued"
            };

            var errorIds = {
                "2": "invalidParameter",
                "5": "htmlPlayerError",
                "100": "videoNotFound",
                "101": "notAllowedEmbedded",
                "150": "notAllowedEmbedded"
            };

            var playerVars = params.playerVars || {};
            delete playerVars.origin;
            this.player = new this.window.YT.Player("youtubeplayer", {
                height: params.height || "390",
                width: params.width || "640",
                playerVars: playerVars,
                events: {
                    "onReady": function(event) {
                        that.postMessage("youtube.volume", {"volume": that.player.getVolume()});
                        that.postMessage("youtube.playerReady", {"playerReady": true});
                    },
                    "onStateChange": function(event) {
                        var msg = stateEvents[event.data];
                        if (typeof msg === "undefined") {
                            console.warn("Unknown YouTube player state", event)
                            return;
                        }

                        switch (msg) {
                        case "youtube.playing":
                            that.prevTime = null;
                            that.startDetectSeek();
                            break;
                        case "youtube.buffering":
                            that.startDetectSeek();
                            break;
                        case "youtube.paused":
                            that.stopDetectSeek();
                            break;
                        case "youtube.ended":
                            that.stopDetectSeek();
                            break;
                        }

                        that.postMessage("youtube.event", {"event": msg, "state": event.data, "position": that.player.getCurrentTime()});
                    },
                    "onError": function(event) {
                        var error = errorIds[event.data] || "unknownError";
                        that.postMessage("youtube.error", {"msgid": error, "code": event.data});
                    }
                }
            });
        }
    };

    YouTubeSandbox.prototype.destroyPlayer = function() {
        this.stopDetectSeek();
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
    };

    YouTubeSandbox.prototype.loadVideo = function(id, position) {
        this.prevTime = null;
        this.prevNow = null;
        if (typeof(position) !== "undefined") {
            this.player.loadVideoById(id, position);
        } else {
            this.player.loadVideoById(id);
        }
    };

    YouTubeSandbox.prototype.playVideo = function() {
        this.player.playVideo();
    };

    YouTubeSandbox.prototype.pauseVideo = function() {
        this.player.pauseVideo();
    };

    YouTubeSandbox.prototype.stopVideo = function() {
        this.player.stopVideo();
    };

    YouTubeSandbox.prototype.seekTo = function(position, allowSeekAhead) {
        if (typeof(allowSeekAhead) !== "undefined") {
            this.player.seekTo(position, allowSeekAhead);
        } else {
            this.player.seekTo(position);
        }
    };

    YouTubeSandbox.prototype.setVolume = function(volume) {
        this.player.setVolume(volume);
    };

    YouTubeSandbox.prototype.startDetectSeek = function() {
        var that = this;
        var checkSeek = function() {
            if (!that.player) {
                return;
            }
            var now = new Date();
            var time = that.player.getCurrentTime();
            that.postMessage("youtube.position", {"position": time});
            if (that.prevTime === null) {
                that.prevTime = time;
            }
            if (that.prevNow === null) {
                that.prevNow = now;
            }
            var deltaTime = Math.abs(time - that.prevTime);
            var deltaNow = (now - that.prevNow) * 0.001;
            if (deltaTime > deltaNow * 1.1) {
                that.postMessage("youtube.event", {"event": "youtube.seeked", "position": time});
            }
            that.prevNow = now;
            that.prevTime = time;
        };

        if (!this.seekDetector) {
            this.seekDetector = this.window.setInterval(function() {
                checkSeek();
            }, 1000);
        }
        checkSeek();
    };

    YouTubeSandbox.prototype.stopDetectSeek = function() {
        if (this.seekDetector) {
            this.window.clearInterval(this.seekDetector);
            this.seekDetector = null;
        }
        this.prevNow = null;
    };

    var sandbox = new YouTubeSandbox(window);

    window.onYouTubeIframeAPIReady = function() {
        sandbox.onYouTubeIframeAPIReady();
    };

    window.addEventListener("message", function(event) {
        if (event.origin !== PARENT_ORIGIN) {
            // only accept messages from spreed-webrtc
            return;
        }
        var msg = event.data;
        var data = msg[msg.type] || {};
        switch (msg.type) {
        case "loadApi":
            sandbox.loadApi(data.url);
            break;
        case "loadPlayer":
            sandbox.loadPlayer(data);
            break;
        case "destroyPlayer":
            sandbox.destroyPlayer();
            break;
        case "loadVideo":
            sandbox.loadVideo(data.id, data.position);
            break;
        case "playVideo":
            sandbox.playVideo();
            break;
        case "pauseVideo":
            sandbox.pauseVideo();
            break;
        case "stopVideo":
            sandbox.stopVideo();
            break;
        case "seekTo":
            sandbox.seekTo(data.position, data.allowSeekAhead);
            break;
        case "setVolume":
            sandbox.setVolume(data.volume);
            break;
        default:
            console.log("Unknown message received", event);
            break;
        }
    }, false);

    console.log("YouTube sandbox ready.");
    sandbox.postMessage("ready", {"ready": true});

})();
