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
define(['underscore', 'jquery', 'modernizr', 'text!partials/contactsmanager.html', 'text!partials/contactsmanageredit.html'], function(_, $, Modernizr, templateContactsManager, templateContactsManagerEdit) {

	// contactsManager
	return [function() {

		var ContactsmanagerModalController = ["$scope", "$modalInstance", "contactData", "data", "contacts", 'buddySession', function($scope, $modalInstance, contactData, data, contacts, buddySession) {
			$scope.header = data.header;
			$scope.contacts = [];
			$scope.search = {};
			var tmp = {};
			tmp.displayName = data.contact ? data.contact.Status.displayName : null;
			$scope.contact = data.contact;
			$scope.session = null;

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

			$scope.edit = function(contact) {
				$modalInstance.close(contact);
			};

			$scope.save = function() {
				setContactInfo($scope.contact);
				$modalInstance.close();
			};

			$scope.cancel = function(contact) {
				$scope.contact.Status.displayName = tmp.displayName;
				$modalInstance.dismiss();
			};

		}];

		var controller = ['$scope', 'dialogs', 'translation', '$templateCache', function($scope, dialogs, translation, $templateCache) {

			$templateCache.put('/contactsmanager/main.html', templateContactsManager);
			$templateCache.put('/contactsmanager/edit.html', templateContactsManagerEdit);

			var ContactsManager = {};
			ContactsManager._mainDialog = function() {
				return dialogs.create(
					"/contactsmanager/main.html",
					ContactsmanagerModalController,
					{
						header: translation._("Contacts Manager")
					}, {
						wc: "contactsmanager"
					}
				);
			};
			ContactsManager._editDialog = function(contact) {
				return dialogs.create(
					"/contactsmanager/edit.html",
					ContactsmanagerModalController,
					{
						header: translation._("Edit Contact"),
						contact: contact,
					}, {
						wc: "contactsmanager"
					}
				);
			};
			ContactsManager.setupContactsManager = function() {
				var that = this;

				var dlgMain = that._mainDialog();
				dlgMain.result.then(function(contact) {
					if (contact && contact.Id) {
						that.setupContactsManagerEdit(contact);
					}
				});
			};
			ContactsManager.setupContactsManagerEdit = function(contact) {
				var that = this;

				var dlgEdit = that._editDialog(contact);
				dlgEdit.result.finally(function(final) {
					that.setupContactsManager();
				});
			};
			ContactsManager.open = function() {
				this.setupContactsManager();
			};

			$scope.openContactsManager = function() {
				ContactsManager.open();
			};

		}];

		return {
			scope: true,
			restrict: "A",
			controller: controller,
		};

	}];

});
