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
define(['jquery', 'underscore', 'text!partials/audiovideo.html', 'text!partials/audiovideopeer.html', 'bigscreen', 'injectCSS', 'webrtc.adapter', 'rAF'], function($, _, template, templatePeer, BigScreen) {

    return ["$window", "$compile", "$filter", "mediaStream", "safeApply", "desktopNotify", "buddyData", "videoWaiter", function($window, $compile, $filter, mediaStream, safeApply, desktopNotify, buddyData, videoWaiter) {

        var requestAnimationFrame = $window.requestAnimationFrame;
        var peerTemplate = $compile(templatePeer);

        var controller = ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {

            var peers = {};
            var events = $({});

            $scope.card = $element;
            $scope.container = $element.parent().get(0);
            $scope.layoutparent = $element.parent().parent();

            $scope.remoteVideos = $element.find("#remoteVideos").get(0);
            $scope.localVideo = $element.find("#localVideo").get(0);
            $scope.miniVideo = $element.find("#miniVideo").get(0);
            $scope.mini = $element.find("#mini");

            $scope.hasUsermedia = false;
            $scope.isActive = false;
            //console.log("audiovideo", localVideo, miniVideo);

            $scope.addRemoteStream = function(stream, currentcall) {

                //console.log("Add remote stream to scope", pc.id, stream);
                var subscope = $scope.$new(true);
                var peerid = subscope.peerid = currentcall.id;
                buddyData.push(peerid);
                subscope.withvideo = false;
                subscope.onlyaudio = false;
                subscope.applyTalking = function(talking) {
                    var element = subscope.element;
                    var has = element.hasClass("talking");
                    if (talking && !has) {
                        element.addClass("talking");
                    } else if (!talking && has) {
                        element.removeClass("talking");
                    }
                };
                subscope.$on("active", function() {
                    console.log("Stream scope is now active", peerid);
                    events.triggerHandler("active."+peerid, [subscope, currentcall, stream]);
                });
                console.log("Created stream scope", peerid);

                peerTemplate(subscope, function(clonedElement, scope) {
                    $($scope.remoteVideos).append(clonedElement);
                    scope.element = clonedElement;
                    var video = clonedElement.find("video").get(0);
                    $window.attachMediaStream(video, stream);
                    // Waiter callbacks also count as connected, as browser support (FireFox 25) is not setting state changes properly.
                    videoWaiter.wait(video, stream, function(withvideo) {
                        peers[peerid] = scope;
                        if (withvideo) {
                            scope.$apply(function($scope) {
                                $scope.withvideo = true;
                            });
                        } else {
                            console.info("Incoming stream has no video tracks.");
                            scope.$apply(function($scope) {
                                $scope.onlyaudio = true;
                            });
                        }
                        scope.$emit("active", currentcall);
                        $scope.resize();
                    }, function() {
                        peers[peerid] = scope;
                        console.warn("We did not receive video data for remote stream", currentcall, stream, video);
                        scope.$emit("active", currentcall);
                        $scope.resize();
                    });
                    scope.doChat = function() {
                        $scope.$emit("startchat", currentcall.id, {autofocus: true, restore: true});
                    };
                });

            };

            $scope.removeRemoteStream = function(stream, currentcall) {

                var subscope = peers[currentcall.id];
                if (subscope) {
                    buddyData.pop(currentcall.id);
                    delete peers[currentcall.id];
                    //console.log("remove scope", subscope);
                    if (subscope.element) {
                        subscope.element.remove();
                    }
                    subscope.$destroy();
                    $scope.resize();
                }

            };

            // Talking updates receiver.
            mediaStream.api.e.on("received.talking", function(event, id, from, talking) {
                var scope = peers[from];
                //console.log("received.talking", talking, scope);
                if (scope) {
                    scope.applyTalking(talking);
                } else {
                    console.log("Received talking state without scope -> adding event.", from, talking);
                    events.one("active."+from, function(event, scope) {
                        console.log("Applying previously received talking state", from, talking);
                        scope.applyTalking(talking);
                    });
                }
            });

            $scope.$on("active", function(currentcall) {

                //console.log("active 2");
                if (!$scope.isActive) {
                    $scope.isActive = true;
                    $scope.remoteVideos.style.opacity = 1;
                    $scope.card.addClass("active");
                    //console.log("active 3");
                    _.delay(function() {
                        $scope.localVideo.style.opacity = 0;
                        $scope.localVideo.src = "";
                    }, 500);
                    _.delay(function() {
                        //console.log("active 4", $scope.mini);
                        $scope.mini.addClass("visible"); //.style.opacity = 1;
                    }, 1000);
                }

            });

            $scope.toggleFullscreen = function() {
                if (BigScreen.enabled && ($scope.isActive || $scope.hasUsermedia)) {
                    $scope.layoutparent.toggleClass("fullscreen");
                    BigScreen.toggle($scope.layoutparent.get(0));
                }
            };

            mediaStream.webrtc.e.on("usermedia", function(event, usermedia) {

                //console.log("XXXXXXXXXXXXXXXXXXXXXXXXX usermedia event", usermedia);
                $scope.hasUsermedia = true;
                usermedia.attachMediaStream($scope.localVideo);
                var count = 0;
                var waitForLocalVideo = function() {
                    if (!$scope.hasUsermedia) {
                      return;
                    }
                    if ($scope.localVideo.videoWidth > 0) {
                        $scope.localVideo.style.opacity = 1;
                        $scope.resize();
                    } else {
                        count++;
                        if (count < 100) {
                            setTimeout(waitForLocalVideo, 100);
                        } else {
                            console.warn("Timeout while waiting for local video.")
                        }
                    }
                };
                waitForLocalVideo();

            });

            mediaStream.webrtc.e.on("done", function() {

                $scope.hasUsermedia = false;
                $scope.isActive = false;
                if (BigScreen.enabled) {
                    BigScreen.exit();
                }
                _.delay(function() {
                    if ($scope.isActive) {
                        return;
                    }
                    $scope.localVideo.src = '';
                    $scope.miniVideo.src = '';
                    $($scope.remoteVideos).empty();
                }, 1500);
                $scope.mini.removeClass("visible");
                $scope.localVideo.style.opacity = 0;
                $scope.remoteVideos.style.opacity = 0;
                $scope.card.removeClass('active');
                _.each(peers, function(scope, k) {
                    scope.$destroy();
                    delete peers[k];
                });

            });

            mediaStream.webrtc.e.on("streamadded", function(event, stream, currentcall) {

                console.log("Remote stream added.", stream, currentcall);
                if (_.isEmpty(peers)) {
                    //console.log("First stream");
                    $window.reattachMediaStream($scope.miniVideo, $scope.localVideo);
                }
                $scope.addRemoteStream(stream, currentcall);

            });

            mediaStream.webrtc.e.on("streamremoved", function(event, stream, currentcall) {

                console.log("Remote stream removed.", stream, currentcall);
                $scope.removeRemoteStream(stream, currentcall);

            });

            return {
                peers: peers
            };

        }];

        var compile = function(tElement, tAttr) {

            return function(scope, iElement, iAttrs, controller) {

                //console.log("compile", arguments)

                $(scope.card).on("doubletap", function() {
                    scope.toggleFullscreen();
                });

                var needsResize = false;
                scope.resize = function() {
                    needsResize = true;
                };

                var resize = function() {

                    var videos = _.keys(controller.peers);

                    var videoWidth;
                    var videoHeight;

                    if (videos.length) {
                        if (videos.length === 1) {
                            var remoteVideo = controller.peers[videos[0]].element.find("video").get(0);
                            videoWidth = remoteVideo.videoWidth;
                            videoHeight = remoteVideo.videoHeight;
                            console.log("Remote video size: ", videoWidth, videoHeight);
                        } else {
                            videoWidth = 1920;
                            videoHeight = 1080;
                        }
                    }

                    if (!videoWidth) {
                        if (scope.localVideo.style.opacity === '1') {
                            videoWidth = scope.localVideo.videoWidth;
                            videoHeight = scope.localVideo.videoHeight;
                            console.log("Local video size: ", videoWidth, videoHeight);
                            videos = [null];
                        }
                    }

                    if (!videos.length) {
                        return;
                    }

                    if (!videoWidth) {
                        videoWidth = 640;
                    }
                    if (!videoHeight) {
                        videoHeight = 360;
                    }

                    var aspectRatio = videoWidth/videoHeight;
                    var innerHeight = scope.layoutparent.height();
                    var innerWidth = scope.layoutparent.width();
                    var container = scope.container;

                    //console.log("resize", innerHeight, innerWidth);
                    //console.log("resize", container, videos.length, aspectRatio, innerHeight, innerWidth);

                    if (videos.length === 1) {
                        var newVideoWidth = innerWidth < aspectRatio * innerHeight ? innerWidth : aspectRatio * innerHeight;
                        var newVideoHeight = innerHeight < innerWidth / aspectRatio ? innerHeight : innerWidth / aspectRatio;
                        container.style.width = newVideoWidth + 'px';
                        container.style.height = newVideoHeight + 'px';
                        container.style.left = ((innerWidth - newVideoWidth) / 2) + 'px';
                        var extraCSS = {};
                    } else {
                        var space = innerHeight*innerWidth; // square pixels
                        var videoSpace = space/videos.length;
                        var singleVideoWidthOptimal = Math.pow(videoSpace * aspectRatio, 0.5);
                        var videosPerRow = Math.ceil(innerWidth/singleVideoWidthOptimal)
                        var singleVideoWidth = Math.ceil(innerWidth/videosPerRow);
                        var singleVideoHeight = Math.ceil(singleVideoWidth/aspectRatio);
                        var newContainerWidth = (videosPerRow*singleVideoWidth);
                        var newContainerHeight = Math.ceil(videos.length/videosPerRow)*singleVideoHeight;
                        if (newContainerHeight*1.3 <= innerHeight) {
                            newContainerHeight = newContainerHeight*1.3;
                        }
                        /*
                        console.log("space", space);
                        console.log("videospace", videoSpace);
                        console.log("singleVideoWidthOptimal", singleVideoWidthOptimal);
                        console.log("videosPerRow", videosPerRow);
                        console.log("singleVideoWidth", singleVideoWidth);
                        console.log("singleVideoHeight", singleVideoHeight);
                        */
                        container.style.width = newContainerWidth + "px";
                        container.style.height = newContainerHeight + "px";
                        container.style.left = ((innerWidth - newContainerWidth) / 2) + 'px';
                        extraCSS = {
                            "#remoteVideos": {
                                ">div": {
                                    width: singleVideoWidth+"px",
                                    height: singleVideoHeight+"px"
                                }
                            }
                        };
                    }
                    $.injectCSS(extraCSS, {
                        truncateFirst: true,
                        containerName: "audiovideo-dynamic"
                    });

                }

                $($window).on("resize", scope.resize);
                scope.$on("mainresize", function() {
                    _.defer(scope.resize);
                });
                scope.resize();

                var update = function() {
                    if (needsResize) {
                        needsResize =false;
                        resize();
                    }
                    requestAnimationFrame(update);
                }
                update();

            }

        };

        return {
            restrict: 'E',
            replace: true,
            scope: true,
            template: template,
            controller: controller,
            compile: compile
        }

    }];

});
