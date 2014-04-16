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
define(["jquery", "underscore"], function($, _) {

	var dynamicCSSContainer = "audiovideo-dynamic";
	var renderers = {};

	// videoLayout
	return [function() {

		// Video layout with all persons rendered the same size.
		var OnePeople = function(scope, controller) {
			this.stylesBackup = {
				width: scope.container.style.width,
				left: scope.container.style.left
			}
		};

		OnePeople.prototype.name = "onepeople";

		OnePeople.prototype.render = function(scope, videos, peers) {

			if (this.closed) {
				return;
			}

            var videoWidth;
            var videoHeight;

            if (videos.length) {
                if (videos.length === 1) {
                    var remoteVideo = peers[videos[0]].element.find("video").get(0);
                    videoWidth = remoteVideo.videoWidth;
                    videoHeight = remoteVideo.videoHeight;
                    console.log("Remote video size: ", videoWidth, videoHeight);
                } else {
                    videoWidth = 1920;
                    videoHeight = 1080;
                }
            }

            if (!videoWidth) {
            	// XXX(longsleep): Improve this condition - its crap to compare style opacity (tm)!
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
                container.style.left = ((innerWidth - newVideoWidth) / 2) + 'px';
                var extraCSS = {};
            } else {
                var space = innerHeight*innerWidth; // square pixels
                var videoSpace = space/videos.length;
                var singleVideoWidthOptimal = Math.pow(videoSpace * aspectRatio, 0.5);
                var videosPerRow = Math.ceil(innerWidth/singleVideoWidthOptimal);
                if (videosPerRow > videos.length) {
                    videosPerRow = videos.length;
                }
                var singleVideoWidth = Math.ceil(innerWidth/videosPerRow);
                var singleVideoHeight = Math.ceil(singleVideoWidth/aspectRatio);
                var newContainerWidth = (videosPerRow*singleVideoWidth);
                var newContainerHeight = Math.ceil(videos.length/videosPerRow)*singleVideoHeight;
                if (newContainerHeight > innerHeight) {
                    var tooHigh = (newContainerHeight-innerHeight) / Math.ceil(videos.length / videosPerRow);
                    singleVideoHeight -= tooHigh;
                    singleVideoWidth = singleVideoHeight * aspectRatio;
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
                containerName: dynamicCSSContainer
            });

		};

		OnePeople.prototype.close = function(scope, controller) {

			scope.container.css(this.stylesBackup);
			$.injectCSS({}, {
				truncateFirst: true,
                containerName: dynamicCSSContainer
            });
			this.closed = true;

		};

		// Register renderers.
		renderers[OnePeople.prototype.name] = OnePeople;

		// Public api.
		var current = null;
		return {
			update: function(name, scope, controller) {

				var videos = _.keys(controller.peers);
				var peers = controller.peers;

				if (!current) {
					current = new renderers[name](scope, controller)
					console.log("Created new video layout renderer", name, current);
				} else {
					if (current.name !== name) {
						current.close(scope, controller);
						current = new renderers[name](scope, conroller)
						console.log("Switched to new video layout renderer", name, current);
					}
				}

				current.render(scope, videos, peers);

			},
			register: function(name, impl) {
				renderers[name] = impl;
			}
		}

	}];

});