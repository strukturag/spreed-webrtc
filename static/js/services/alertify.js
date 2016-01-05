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
define(["angular"], function(angular) {

	var modalController = ["$scope", "$modalInstance", "data", function($scope, $modalInstance, data) {
		$scope.input = {
			text: ''
		};
		$scope.id = data.id;
		$scope.header = data.header || "";
		$scope.msg = data.message || "";
		$scope.okButtonLabel = data.okButtonLabel || "Ok";
		$scope.cancelButtonLabel = data.cancelButtonLabel || "Cancel";

		$scope.cancel = function() {
			$modalInstance.dismiss('Canceled');
		};
		$scope.save = function() {
			$modalInstance.close($scope.input.text);
		};
		$scope.hitEnter = function(evt) {
			if (angular.equals(evt.keyCode, 13) && !(angular.equals($scope.input.text, null) || angular.equals($scope.input.text, ''))) {
				$scope.save();
			}
		};
		$scope.ok = function() {
			$modalInstance.close('Ok');
		};
		$scope.close = function() {
			$modalInstance.close('Close');
		};
	}];

	// Alertify uniquified api wrapper
	return ["$window", "$modal", "$templateCache", "translation", function($window, $modal, $templateCache, translation) {

		// Overwrite templates from dialogs with fontawesome/i18n variants.
		$templateCache.put('/dialogs/error.html', '<div class="modal-header dialog-header-error"><button type="button" class="close" ng-click="close()">&times;</button><h3 class="modal-title text-danger"><span ng-bind-html="header"></span></h3></div><div class="modal-body text-danger h4" ng-bind-html="msg"></div><div class="modal-footer"><button type="button" class="btn btn-default" ng-click="close()">{{_("Close")}}</button></div>');
		$templateCache.put('/dialogs/wait.html', '<div class="modal-header dialog-header-wait"><h3 class="modal-title">Please Wait</h3></div><div class="modal-body"><p ng-bind-html="msg"></p><div class="progress progress-striped active"><div class="progress-bar progress-bar-info" ng-style="getProgress()"></div><span class="sr-only">{{progress}}% Complete</span></div></div>');
		$templateCache.put('/dialogs/notify.html', '<div class="modal-header dialog-header-notify"><button type="button" class="close" ng-click="close()" class="pull-right">&times;</button><h3 class="modal-title">{{header}}</h3></div><div class="modal-body h4" ng-bind-html="msg"></div><div class="modal-footer"><button type="button" class="btn btn-primary" ng-click="close()">{{_("Ok")}}</button></div>');
		$templateCache.put('/dialogs/confirm.html', '<div class="modal-header dialog-header-confirm"><button type="button" class="close" ng-click="cancel()">&times;</button><h3 class="modal-title">{{header}}</h3></div><div class="modal-body h4" ng-bind-html="msg"></div><div class="modal-footer"><button type="button" class="btn btn-default" ng-click="ok()">{{_("Ok")}}</button><button type="button" class="btn btn-primary" ng-click="cancel()">{{_("Cancel")}}</button></div>');

		// Add new template for prompt.
		$templateCache.put('/dialogs/prompt.html', '<div class="modal-header"><h3 class="modal-title"><span ng-bind-html="header"></span></h3></div><div class="modal-body"><ng-form name="promptDialog" novalidate role="form"><div class="form-group input-group-lg" ng-class="{true: \'has-error\'}[promptDialog.text.$dirty && promptDialog.text.$invalid]"><label class="control-label"></label><input type="text" id="{{id}}" class="form-control" name="text" ng-model="input.text" ng-keyup="hitEnter($event)" required></div></ng-form></div><div class="modal-footer"><button type="button" class="btn btn-default" ng-click="cancel()">{{cancelButtonLabel}}</button><button type="button" class="btn btn-primary" ng-click="save()" ng-disabled="(promptDialog.$dirty && promptDialog.$invalid) || promptDialog.$pristine">{{okButtonLabel}}</button></div>');

		var defaultMessages = {
			error: translation._("Error"),
			notify: translation._("Hint"),
			confirm: translation._("Please confirm"),
			prompt: translation._("More information required"),
			okButtonLabel: translation._("Ok"),
			cancelButtonLabel: translation._("Cancel"),
			closeButtonLabel: translation._("Close")
		};

		var promptIdx = 0;

		var api = {
			defaultMessages: defaultMessages
		};

		var setupModal = function(data, type) {
			return $modal.open({
				templateUrl: '/dialogs/' + type +'.html',
				controller: modalController,
				resolve: {
					data: function() { return data; }
				}
			});
		};

		var registeredCustomDialog = [];
		var dialog = {
			/**
			* registerCustom registers a custom dialog. To overwrite an existing custom dialog simply use the same id.
			*
			* @param {Object} config Preferences for the custom dialog with the following properties:
			* @param {String} config.baseType Existing dialog type to use as initial values and from which a template will be used.
			* @param {String} config.type The ID of the custom dialog. The template name which is saved in $templateCache. If the the type is 'notify' the templateUrl must be '/dialogs/notify.html'.
			* @param {String} [config.template] A custom template to use for the dialog instead of the baseType template.
			* @param {String} [config.title] The title which the baseType modal dialog should display. If none is provided the baseType title is used.
			* @param {String} [config.message] The message which the baseType modal dialog should display.
			* @param {Function} [config.ok_cb] The callback function to be called on success.
			* @param {Function} [config.err_cb] The callback function to be called on error.
			*/
			registerCustom: function(config) {
				var conf = angular.extend({}, config);
				if (!conf ||
					conf && !conf.type ||
					conf && !conf.baseType) {
					throw new Error("Custom template not configured correctly.");
				}
				var templateUrl = '/dialogs/' + conf.type + '.html';
				if (conf.template) {
					$templateCache.put(templateUrl, conf.template);
				} else {
					$templateCache.put(templateUrl, $templateCache.get('/dialogs/' + conf.baseType + '.html'));
				}
				if (!conf.title) {
					conf.title = api.defaultMessages[conf.baseType];
				}
				registeredCustomDialog[conf.type] = conf;
			},
			exec: function(n, title, message, ok_cb, err_cb) {
				if (!message && title) {
					message = title;
					title = null;
				}
				if (!title) {
					title = api.defaultMessages[n] || n;
				}
				var dlg = setupModal({'header': title, 'message': message}, n);
				if (ok_cb) {
					dlg.result.then(ok_cb, err_cb);
				}
				return dlg;
			},
			custom: function(type) {
				var config = registeredCustomDialog[type];
				if (!config) {
					throw new Error('The custom dialog type "' + type + '" is not registered.');
				}
				return dialog.exec(config.type, config.title, config.message, config.ok_cb, config.err_cb);
			},
			error: function(title, message, ok_cb, err_cb) {
				return dialog.exec("error", title, message, ok_cb, err_cb);
			},
			notify: function(title, message, ok_cb, err_cb) {
				return dialog.exec("notify", title, message, ok_cb, err_cb);
			},
			alert: function(message, ok_cb, title) {
				// Legacy function for compatibility with alertify.
				return dialog.notify(title, message, ok_cb);
			},
			confirm: function(message, ok_cb, err_cb, title) {
				// Legacy function for compatibility with alertify.
				return dialog.exec("confirm", null, message, ok_cb, err_cb);
			},
			prompt: function(title, ok_cb, err_cb) {
				var id = "allertifyPrompt" + (promptIdx++);
				var data = {
					okButtonLabel: api.defaultMessages.okButtonLabel || "Ok",
					cancelButtonLabel: api.defaultMessages.cancelButtonLabel || "Cancel",
					header: title,
					id: id
				};
				var dlg = setupModal(data, "prompt");
				dlg.result.then(function(text) {
					if (ok_cb) {
						ok_cb(text);
					}
				}, function() {
					if (err_cb) {
						err_cb();
					}
				});
				dlg.opened.then(function() {
					// Crude hack to get auto focus.
					$window.setTimeout(function() {
						var element = $window.document.getElementById(id);
						if (element) {
							element.focus();
						}
					}, 100);
				});
			}
		};

		// Expose the shit.
		api.dialog = dialog;

		return api;

	}];

});
