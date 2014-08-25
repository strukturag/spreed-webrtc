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
define(['underscore', 'jquery', 'modernizr'], function(_, $, Modernizr) {

	// contactsmanager
	return [function() {

		var controller = ['$scope', 'dialogs', 'translation', '$templateCache', function($scope, dialogs, translation, $templateCache) {

			var ContactsManager = {};
			ContactsManager._editDialog = function(contact) {
				return dialogs.create(
					"/contactsmanager/edit.html",
					"ContactsmanagerController",
					{
						header: translation._("Edit Contact"),
						contact: contact,
					}, {
						wc: "contactsmanager"
					}
				);
			};
			ContactsManager.openMainModal = function() {
				var that = this;

				var dlgMain = $scope.dlg.openContactsManager();
				dlgMain.result.then(function(contact) {
					if (contact && contact.Id) {
						that.openEditModal(contact);
					}
				});
			};
			ContactsManager.openEditModal = function(contact) {
				var that = this;

				var dlgEdit = that._editDialog(contact);
				dlgEdit.result.finally(function(final) {
					that.openMainModal();
				});
			};

			$scope.dlg.openEditContact = function(contact) {
				ContactsManager.openEditModal(contact);
			};
		}];

		return {
			scope: true,
			restrict: "A",
			controller: controller,
		};

	}];

});
