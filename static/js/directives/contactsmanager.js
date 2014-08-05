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
define(['underscore', 'jquery'], function(_, $) {

	// contactsmanager
	return [function() {

		var controller = ['$scope', 'dialogs', 'translation', function($scope, dialogs, translation) {

			var editContactDialog = function(index) {
				return dialogs.create(
					"/contactsmanager/edit.html",
					"ContactsmanagerController",
					{
						header: translation._("Edit Contact"),
						contactIndex: index,
					}, {
						wc: "contactsmanager"
					}
				);
			};

			$scope.$on('openEditContact', function(event, index) {
				editContactDialog(index);
			});
		}];

		return {
			scope: true,
			restrict: "A",
			controller: controller,
		};

	}];

});
