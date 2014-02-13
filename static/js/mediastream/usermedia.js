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
define(['jquery', 'underscore', 'audiocontext', 'webrtc.adapter'], function($, _, AudioContext) {

  // Create AudioContext singleton, if supported.
  var context = AudioContext ? new AudioContext() : null;

  var UserMedia = function(options) {

    this.options = $.extend({}, options);
    this.e = $({}); // Events.

    this.localStream = null;
    this.started = false;

    // Audio level.
    this.audioLevel = 0;
    if (!this.options.noaudio && context) {
      this.audioSource = null;
      this.audioProcessor = context.createScriptProcessor(2048, 1, 1);
      this.audioProcessor.onaudioprocess = _.bind(function(event) {
        // Compute audio input level based on raw PCM data.
        if (!this.audioSource) {
          return;
        }
        var input = event.inputBuffer.getChannelData(0);
        var len = input.length
        var total = 0;
        var i = 0;
        while (i < len) {
          total += Math.abs(input[i++]);
        }
        // http://en.wikipedia.org/wiki/Root_mean_square
        var rms = Math.sqrt(total / len);
        this.audioLevel = rms;
        //console.log("this.audioLevel", this.audioLevel);
      }, this);
    }

  };

  // Static.
  UserMedia.testGetUserMedia = function(success_cb, error_cb) {

    console.log("Requesting testGetUserMedia");
    try {
      getUserMedia({video:true, audio:true}, success_cb, error_cb);
    } catch(e) {
      console.error('getUserMedia failed with exception: '+ e.message);
      error_cb(e);
    }

  };

  UserMedia.prototype.doGetUserMedia = function(currentcall, mediaConstraints) {

    if (!mediaConstraints) {
      mediaConstraints = currentcall.mediaConstraints;
    }

    try {
      console.log('Requesting access to local media with mediaConstraints:\n' +
                '  \'' + JSON.stringify(mediaConstraints) + '\'');
      getUserMedia(mediaConstraints, _.bind(this.onUserMediaSuccess, this), _.bind(this.onUserMediaError, this));
      this.started = true;
      return true;
    } catch(e) {
      console.error('getUserMedia failed with exception: ' + e.message);
      return false;
    }

  };

  UserMedia.prototype.onUserMediaSuccess = function(stream) {
    console.log('User has granted access to local media.');

    if (!this.started) {
      stream.stop();
      return;
    }

    // Get notified of end events.
    stream.onended = _.bind(function(event) {
      console.log("User media stream ended.");
      this.stop();
    }, this);

    if (this.audioProcessor) {
      // Connect to audioProcessor.
      this.audioSource = context.createMediaStreamSource(stream);
      //console.log("got source", this.audioSource);
      this.audioSource.connect(this.audioProcessor);
      this.audioProcessor.connect(context.destination);
    }
    this.localStream = stream;

    // Let webrtc handle the rest.
    this.e.triggerHandler("mediasuccess", [this]);

  };

  UserMedia.prototype.onUserMediaError = function(error) {
    console.error('Failed to get access to local media. Error was ' + error.name, error);

    if (!this.started) {
      return;
    }

    // Let webrtc handle the rest.
    this.e.triggerHandler("mediaerror", [this]);

  };

  UserMedia.prototype.stop = function() {

    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    if (this.localStream) {
      this.localStream.stop()
      this.localStream = null;
    }
    if (this.audioProcessor) {
      this.audioProcessor.disconnect()
    }
    this.audioLevel = 0;
    this.started = false;
    console.log("Stopped user media.");
    this.e.triggerHandler("stopped", [this]);

  };

  UserMedia.prototype.applyAudioMute = function(mute) {

    if (this.localStream) {

        var audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
          //console.log('No local audio available.');
          return;
        }

        for (i = 0; i < audioTracks.length; i++) {
          audioTracks[i].enabled = !mute;
        }

        if (mute) {
          console.log("Local audio muted.")
        } else {
          console.log("Local audio unmuted.")
        }

    }

    return mute;

  };

  UserMedia.prototype.applyVideoMute = function(mute) {

    if (this.localStream) {

        var videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length === 0) {
          //console.log('No local video available.');
          return;
        }

        for (i = 0; i < videoTracks.length; i++) {
          videoTracks[i].enabled = !mute;
        }

        if (mute) {
          console.log("Local video muted.")
        } else {
          console.log("Local video unmuted.")
        }

    }

    return mute;

  };

  UserMedia.prototype.addToPeerConnection = function(pc) {

    console.log("Add stream to peer connection", pc, this.localStream);
    if (this.localStream) {
      pc.addStream(this.localStream);
    }

  };

  UserMedia.prototype.attachMediaStream = function(video) {

    //console.log("attach", video, this.localStream);
    attachMediaStream(video, this.localStream);

  };

  return UserMedia;

});
