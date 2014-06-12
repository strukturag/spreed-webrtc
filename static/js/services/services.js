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
define([
	'underscore',

	'services/desktopnotify',
	'services/playsound',
	'services/safeapply',
	'services/mediastream',
	'services/appdata',
	'services/buddydata',
	'services/buddylist',
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
	'services/localstorage'], function(_,
desktopNotify,
playSound,
safeApply,
mediaStream,
appData,
buddyData,
buddyList,
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
localStorage) {

	var services = {
		desktopNotify: desktopNotify,
		playSound: playSound,
		safeApply: safeApply,
		mediaStream: mediaStream,
		appData: appData,
		buddyData: buddyData,
		buddyList: buddyList,
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
		localStorage: localStorage
	};

	var initialize = function(angModule) {
		_.each(services, function(service, name) {
			angModule.factory(name, service);
		})
	}

	return {
		initialize: initialize
	};

});
