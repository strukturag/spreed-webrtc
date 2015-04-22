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

	// ContactsmanagereditController
	return ["$scope", "$modalInstance", "data", "contacts", 'buddyData', function($scope, $modalInstance, data, contacts, buddyData) {
		$scope.header = data.header;
		$scope.contact = data.contact ? data.contact : null;
		$scope.buddySyncable = false;

		var originalDisplayName = null;
		var setContactInfo = function(contact) {
			contacts.update(contact);
		};
		if ($scope.contact) {
			originalDisplayName = $scope.contact.Status.displayName;
			var scope = buddyData.lookup($scope.contact.Userid, false, false);
			if (scope) {
				var session = scope.session.get();
				$scope.buddySyncable = session && session.Type ? true : false;
			}
		}

		$scope.removeContact = function() {
			contacts.remove($scope.contact.Userid);
			$modalInstance.close();
		};

		$scope.syncContactInfo = function() {
			var scope = buddyData.lookup($scope.contact.Userid, false, false);
			if (scope) {
				var session = scope.session.get();
				$scope.contact.Status.displayName = session.Status.displayName;
			}
		};

		$scope.save = function() {
			setContactInfo($scope.contact);
			$modalInstance.close();
		};

		$scope.cancel = function(contact) {
			$scope.contact.Status.displayName = originalDisplayName;
			$modalInstance.dismiss();
		};

	}];

});
