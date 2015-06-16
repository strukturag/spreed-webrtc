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
define([], function() {

	// ContactsmanagerController
	return ["$scope", "$modalInstance", "contactData", "data", "contacts", "dialogs", "translation", "mediaStream", "buddyData", function($scope, $modalInstance, contactData, data, contacts, dialogs, translation, mediaStream, buddyData) {
		var getContactSessionId = function(userid) {
			var session = null;
			var scope = buddyData.lookup(userid, false, false);
			if (scope) {
				session = scope.session.get();
			}
			return session && session.Id ? session.Id : null;
		};
		$scope.header = data.header;
		$scope.contacts = [];
		$scope.openContactsManagerEdit = function(contact) {
			return dialogs.create(
				"/contactsmanager/edit.html",
				"ContactsmanagereditController",
				{
					header: translation._("Edit Contact"),
					contact: contact,
				}, {
					wc: "contactsmanager contactsmanageredit"
				}
			);
		};
		var updateContacts = function() {
			$scope.contacts = contactData.getAll();
		};
		updateContacts();
		contacts.e.on('contactadded', function() {
			updateContacts();
		});
		contacts.e.on('contactupdated', function() {
			updateContacts();
		});
		contacts.e.on('contactremoved', function() {
			updateContacts();
		});
		$scope.doCall = function(contact) {
			mediaStream.webrtc.doCall(getContactSessionId(contact.Userid));
			$modalInstance.close();
		};
		$scope.startChat = function(contact) {
			$scope.$emit("startchat", getContactSessionId(contact.Userid), {
				autofocus: true,
				restore: true
			});
			$modalInstance.close();
		};
	}];

});
