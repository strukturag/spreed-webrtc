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

	return ["dialogs", "translation", "$templateCache", function(dialogs, translation, $templateCache) {

		// Inject our templates.
		$templateCache.put('/contactsmanager/main.html', templateContactsManager);
		$templateCache.put('/contactsmanager/edit.html', templateContactsManagerEdit);

		var ContactsManager = {};
		ContactsManager._mainDialog = function() {
			return dialogs.create(
				"/contactsmanager/main.html",
				"ContactsmanagerController",
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
				"ContactsmanagerController",
				{
					header: translation._("Edit Contact"),
					contact: contact,
				}, {
					wc: "contactsmanager"
				}
			);
		};
		ContactsManager.setupContactsManager = function() {
			var dlgMain = null;
			var that = this;

			dlgMain = that._mainDialog();
			dlgMain.result.then(function(contact) {
				if(contact && contact.Id) {
					that.setupContactsManagerEdit(contact);
				}
			});
		};
		ContactsManager.setupContactsManagerEdit = function(contact) {
			var dlgEdit = null;
			var that = this;

			dlgEdit = that._editDialog(contact);
			dlgEdit.result.finally(function(final) {
				that.setupContactsManager();
			});
		};
		ContactsManager.open = function() {
			this.setupContactsManager();
		};

		return ContactsManager;

	}];

});
