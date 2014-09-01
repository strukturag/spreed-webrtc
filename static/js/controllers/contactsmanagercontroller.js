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
	return ["$scope", "$modalInstance", "contactData", "data", "contacts", function($scope, $modalInstance, contactData, data, contacts) {
		$scope.header = data.header;
		$scope.contacts = [];

		var updateContacts = function(async) {
			if (async) {
				$scope.$apply(function(scope) {
					$scope.contacts = contactData.getAll();
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
		contacts.e.on('contactremoved', function() {
			// Do not use $apply, $digest when modal window closes
			updateContacts();
		});

		$scope.edit = function(contact) {
			$scope.$broadcast('openEditContact', contact);
		};
	}];

});
