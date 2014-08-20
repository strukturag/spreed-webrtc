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
define([], function() {

	// ContactsmanagerController
	return ["$scope", "$modalInstance", "contactData", "data", "contacts", 'buddySession', function($scope, $modalInstance, contactData, data, contacts, buddySession) {
		$scope.header = data.header;
		$scope.contacts = [];
		$scope.search = {};
		var tmp = {};
		tmp.displayName = data.contact ? data.contact.Status.displayName : null;
		$scope.contact = data.contact;
		$scope.session = null;
		// Reference to use in contactsmanager directive
		$scope.dlg = {
			openEditContact: null,
			openContactsManager: data.setupContactsManager
		};

		if (data.contact) {
			var sessions = buddySession.sessions();
			for (var id in sessions) {
				if (sessions.hasOwnProperty(id) && sessions[id].Userid === $scope.contact.Userid) {
					$scope.session = sessions[id] ? sessions[id].sessions[id] : null;
					//console.log('contact manager session', $scope.session);
				}
			}
		}

		var totalUnnamed = 0;
		$scope.incrementUnnamedCount = function() {
			return totalUnnamed += 1;
		};

		var updateContacts = function(async) {
			if (async) {
				$scope.$apply(function(scope) {
					scope.contacts = contactData.getAll();
				});
			} else {
				$scope.contacts = contactData.getAll();
			}
		};
		updateContacts();
		contacts.e.on('contactadded', function() {
			updateContacts(true);
		});
		contacts.e.on('contactupdated', function() {
			updateContacts(true);
		});

		var setContactInfo = function(contact) {
			contacts.update(contact.Userid, contact.Status);
		};

		$scope.removeContact = function() {
			contacts.remove($scope.contact.Userid);
			updateContacts();
			$modalInstance.close();
		};

		$scope.syncContactInfo = function() {
			$scope.contact.Status.displayName = $scope.session.Status.displayName;
		};

		$scope.save = function() {
			setContactInfo($scope.contact);
			$modalInstance.close();
		};

		$scope.cancel = function(contact) {
			$scope.contact.Status.displayName = tmp.displayName;
			$modalInstance.dismiss();
		};

		$scope.edit = function(contact) {
			$modalInstance.close($scope.dlg.openEditContact(contact));
		};
	}];

});
