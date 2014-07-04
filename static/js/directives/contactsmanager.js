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
define(['jquery', 'underscore', 'text!partials/contactsmanager.html'], function($, _, templateContactsManager) {

	return [function() {

		var contactsManagerController = ['$scope', '$modalInstance', 'contactData', function($scope, $modalInstance, contactData) {
			$scope.contacts = contactData.getAllContacts();
			$scope.close = function() {
				$modalInstance.close('Close');
			};
		}];

		var controller = ['$scope', '$modal', function($scope, $modal) {
			$scope.contactsManager = function() {
				$modal.open({
					template: templateContactsManager,
					controller: contactsManagerController,
					windowClass: 'contactsManager'
				});
			};
		}];

		var link = function($scope, $element) {};

		return {
			scope: true,
			restrict: 'E',
			controller: controller,
			link: link
		};
	}];

});
