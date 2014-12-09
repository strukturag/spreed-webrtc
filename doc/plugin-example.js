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

"use strict";
define(['angular'], function(angular) {

	return {

		/**
		 * Modules function for this plugin. Use it to add Angular modules.
		 * either overwrite existing modules or add new ones. All app dependencies
		 * are already loaded so modules defined here will be used instead of
		 * the default ones. Defining the module function on a plugin is optional.
		 *
		 * @param {array} modules - To add a new module to the angular app, append
		 *                          the name of the module to the modules array.
		 * @param {Object} launcher - The launcher object containg $q and $http.
		 *
		 */
		module: function(modules, launcher) {

			// Create and add a new module.
			// See http://docs.angularjs.org/guide/module for details on Angular.
			var module = angular.module('myExamplePluginModule', []).
				config([function() { // provider-injector
					// This is an example of config block.
					// You can have as many of these as you want.
					// You can only inject Providers (not instances)
					// into the config blocks.
					console.log("Configuring myExamplePluginModule plugin ...")
				}]).
				run(["$rootScope", function($rootScope) { // instance-injector
					// This is an example of a run block.
					// You can have as many of these as you want.
					// You can only inject instances (not Providers)
					// into the run blocks.
					console.log("Initializing myExamplePluginModule plugin ...");
				}]);

			// Add an example service on module level.
			module.service('myExamplePluginModuleService', [function() {
				return {
					nice: "plugin"
				}
			}]);

			// Inject new module into modules array so that it gets loaded
			// with the App.
			modules.push(module.name);

		},

		/**
		 * Initialize function for this plugin. Use this function to add your
		 * your Angular stuff to the app. The plugin initializse function is
		 * called after the app initialize function.
		 *
		 * @param {App} app - The base Angular module for the web application.
		 * @param {Object} launcher - The launcher object containg $q and $http.
		 * @returns {($q.promise|null)} - Return a $q.promise when you need the
		 *                                launcher to wait.
		 *
		 */
		initialize: function(app, launcher) {

			console.log("Initializing plugin-example ...");

			// Add some directives and services.
			app.service('myExamplePluginInitService', ["$window", function($window) {
				// Service code here ...
				return {
					awesome: "plugin service"
				}
			}]);
			app.directive('myExamplePluginInitDirective', [function() {
				// Directive code here ...
			}]);

		}

	}

});