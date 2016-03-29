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
define([
	'underscore',

	'services/desktopnotify',
	'services/playsound',
	'services/safeapply',
	'services/connector',
	'services/api',
	'services/webrtc',
	'services/mediastream',
	'services/appdata',
	'services/buddydata',
	'services/buddylist',
	'services/buddypicture',
	'services/enrichmessage',
	'services/safemessage',
	'services/alertify',
	'services/toastr',
	'services/visibility',
	'services/translation',
	'services/mediasources',
	'services/fileupload',
	'services/filedownload',
	'services/filedata',
	'services/filetransfer',
	'services/safedisplayname',
	'services/randomgen',
	'services/fastscroll',
	'services/videowaiter',
	'services/videolayout',
	'services/contactdata',
	'services/contacts',
	'services/buddysession',
	'services/localstorage',
	'services/animationframe',
	'services/dialogs',
	'services/geolocation',
	'services/screensharing',
	'services/continueconnector',
	'services/chromeextension',
	'services/usersettingsdata',
	'services/localstatus',
	'services/rooms',
	'services/resturl',
	'services/roompin',
	'services/constraints',
	'services/modules',
	'services/mediadevices',
	'services/sandbox',
	'services/dummystream',
	'services/usermedia',
	'services/playpromise'], function(_,
desktopNotify,
playSound,
safeApply,
connector,
api,
webrtc,
mediaStream,
appData,
buddyData,
buddyList,
buddyPicture,
enrichMessage,
safeMessage,
alertify,
toastr,
visibility,
translation,
mediaSources,
fileUpload,
fileDownload,
fileData,
fileTransfer,
safeDisplayName,
randomGen,
fastScroll,
videoWaiter,
videoLayout,
contactData,
contacts,
buddySession,
localStorage,
animationFrame,
dialogs,
geolocation,
screensharing,
continueConnector,
chromeExtension,
userSettingsData,
localStatus,
rooms,
restURL,
roompin,
constraints,
modules,
mediaDevices,
sandbox,
dummyStream,
userMedia,
playPromise) {

	var services = {
		desktopNotify: desktopNotify,
		playSound: playSound,
		safeApply: safeApply,
		connector: connector,
		api: api,
		webrtc: webrtc,
		mediaStream: mediaStream,
		appData: appData,
		buddyData: buddyData,
		buddyList: buddyList,
		buddyPicture: buddyPicture,
		enrichMessage: enrichMessage,
		safeMessage: safeMessage,
		alertify: alertify,
		toastr: toastr,
		visibility: visibility,
		translation: translation,
		mediaSources: mediaSources,
		fileUpload: fileUpload,
		fileDownload: fileDownload,
		fileData: fileData,
		fileTransfer: fileTransfer,
		safeDisplayName: safeDisplayName,
		randomGen: randomGen,
		fastScroll: fastScroll,
		videoWaiter: videoWaiter,
		videoLayout: videoLayout,
		contactData: contactData,
		contacts: contacts,
		buddySession: buddySession,
		localStorage: localStorage,
		animationFrame: animationFrame,
		dialogs: dialogs,
		geolocation: geolocation,
		screensharing: screensharing,
		continueConnector: continueConnector,
		chromeExtension: chromeExtension,
		userSettingsData: userSettingsData,
		localStatus: localStatus,
		rooms: rooms,
		restURL: restURL,
		roompin: roompin,
		constraints: constraints,
		modules: modules,
		mediaDevices: mediaDevices,
		sandbox: sandbox,
		dummyStream: dummyStream,
		userMedia: userMedia,
		playPromise: playPromise
	};

	var initialize = function(angModule) {
		_.each(services, function(service, name) {
			angModule.factory(name, service);
		});
	};

	return {
		initialize: initialize
	};

});
