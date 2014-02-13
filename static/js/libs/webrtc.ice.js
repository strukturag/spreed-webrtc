/*
 * Simple helper to handle ICE settings with multiple URLs until the browsers
 * support it.
 * See https://www.w3.org/Bugs/Public/show_bug.cgi?id=22347
 * and https://code.google.com/p/webrtc/issues/detail?id=2096
 *
 * Copyright 2013-2014 struktur - http://www.struktur.de
 * LICENSE: WTFPL
 */

var createIceServers = null;

if (navigator.mozGetUserMedia || navigator.webkitGetUserMedia) {

	// Creates iceServers list from the urls for Chrome and FF.
	createIceServers = function(urls, username, credential) {
		var iceServers = [];
		for (var i=0; i<urls.length; i++) {
			var ic = createIceServer(urls[i], username, credential);
			if (ic) {
				iceServers.push(ic);
			}
		}
		return iceServers;
	};

}