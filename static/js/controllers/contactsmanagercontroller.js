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
		$scope.tmp = {};
		$scope.tmp.displayName = data.contact && data.contact.Status.displayName;
		$scope.contact = data.contact;
		$scope.session = null;

		if(data.contact) {
			var sessions = buddySession.sessions();
			for (var id in sessions) {
				if (sessions.hasOwnProperty(id) && sessions[id].Userid === $scope.contact.Userid) {
					$scope.session = sessions[id] && sessions[id].sessions[id];
					//console.log('contact manager session', $scope.session);
				}
			}
		}

		var totalUnnamed = 0;
		$scope.unnamed = function() {
			return totalUnnamed += 1;
		};

		var updateContacts = function() {
			$scope.contacts = contactData.getAll();
		};
		updateContacts();
		contacts.e.on('contactadded', function() {
			updateContacts();
		});

		var setContactInfo = function(contact) {
			contact.Status.displayName = $scope.tmp.displayName;
			contacts.update({Id: contact.Id, Success: contact.Success, Token: contact.Token, Userid: contact.Userid}, contact.Status);
		};

		$scope.removeContact = function() {
			contacts.remove($scope.contact.Userid);
			updateContacts();
			$modalInstance.close();
		};

		$scope.syncContactInfo = function() {
			$scope.tmp.displayName = $scope.session.Status.displayName;
		};

		$scope.edit = function(contact) {
			$modalInstance.close(contact);
		};

		$scope.save = function() {
			setContactInfo(data.contact);
			$modalInstance.close();
		};

		$scope.cancel = function(contact) {
			$modalInstance.dismiss();
		};

	}];

});
