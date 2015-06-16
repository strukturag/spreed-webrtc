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
define([
	'underscore',

	'controllers/uicontroller',
	'controllers/statusmessagecontroller',
	'controllers/chatroomcontroller',
	'controllers/usersettingscontroller',
	'controllers/contactsmanagercontroller',
	'controllers/contactsmanagereditcontroller',
	'controllers/appcontroller'], function(_, UiController, StatusmessageController, ChatroomController, UsersettingsController, ContactsmanagerController, ContactsmanagereditController, AppController) {

	var controllers = {
		UiController: UiController,
		StatusmessageController: StatusmessageController,
		ChatroomController: ChatroomController,
		UsersettingsController: UsersettingsController,
		ContactsmanagerController: ContactsmanagerController,
		ContactsmanagereditController: ContactsmanagereditController,
		AppController: AppController
	};

	var initialize = function(angModule) {
		_.each(controllers, function(controller, name) {
			angModule.controller(name, controller);
		})
	}

	return {
		initialize: initialize
	};

});
