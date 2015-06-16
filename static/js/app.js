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
	'require',
	'jquery',
	'underscore',
	'angular',
	'modernizr',
	'moment',

	'services/services',
	'directives/directives',
	'filters/filters',
	'controllers/controllers',

	'translation/languages',

	'ui-bootstrap',
	'angular-sanitize',
	'angular-animate',
	'angular-humanize',
	'angular-route',

	'mobile-events'

], function(require, $, _, angular, modernizr, moment, services, directives, filters, controllers, languages) {

	// Simple and fast split based URL query parser based on location.search. We require this before the
	// angular App is bootstrap to control initialization parameters like translation based on URL parameters.
	var urlQuery = (function() {
		return (function(a) {
			if (a === "") {
				return {};
			}
			var b = {};
			for (var i = 0; i < a.length; ++i) {
				var p = a[i].split('=');
				if (p.length != 2) {
					continue;
				}
				b[p[0]] = window.decodeURIComponent(p[1].replace(/\+/g, " "));
			}
			return b;
		})(window.location.search.substr(1).split("&"));
	}());

	// Base application config shared during initialization.
	var appConfig = {};

	// Implement translation store.
	var TranslationData = function(default_language, launcher) {
		// Create data structure.
		this.data = {
			locale_data: {}
		};
		this.lang = this.default_lang = default_language;
		this.getHTTP = launcher.$http.get;
	};
	TranslationData.prototype.language = function() {
		// Return language.
		return this.lang;
	};
	TranslationData.prototype.default_language = function() {
		return this.default_lang;
	};
	TranslationData.prototype.add = function(domain, data) {
		var src;
		if (data && data.locale_data) {
			src = data.locale_data[domain];
			// Support older po files built for older jed (see https://github.com/SlexAxton/Jed/issues/36).
			var count = 0;
			var v;
			for (var k in src) {
				if (src.hasOwnProperty(k)) {
					v = src[k];
					if (v.constructor === Array && v[0] === null) {
						v.shift();
					} else {
						count++;
					}
					if (count > 1) {
						break;
					}
				}
			}
		}
		var dst = this.data.locale_data[domain];
		if (!dst) {
			dst = this.data.locale_data[domain] = {
				"": {
					"domain": domain,
					"plural_forms": "nplurals=2; plural=(n != 1);"
				}
			}
		}
		_.extend(dst, src);
	};
	TranslationData.prototype.load = function(domain, url) {
		var that = this;
		return this.getHTTP(url).
			success(function(data) {
				//console.log("loaded translation data", data);
				that.add(domain, data);
			}).
			error(function(data, status) {
				console.warn("Failed to load translation data: " + status);
				that.add(domain, null);
			});
	};
	TranslationData.prototype.get = function() {
		return this.data;
	};

	var create = function(ms, launcher) {

		// Create translation data instance.
		var translationData = launcher.translationData = new TranslationData("en", launcher);

		var modules = ['ui.bootstrap', 'ngSanitize', 'ngAnimate', 'ngHumanize', 'ngRoute'];
		if (ms && ms.length) {
			_.each(ms, function(module) {
				modules.push(module);
			});
		}

		var app = angular.module('app', modules);
		services.initialize(app);
		directives.initialize(app);
		filters.initialize(app);
		controllers.initialize(app);

		app.config(["$compileProvider", "$locationProvider", "$routeProvider", function($compileProvider, $locationProvider, $routeProvider) {
			// Allow angular to use filesystem: hrefs which would else be prefixed with unsafe:.
			$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|filesystem|blob):/);
			$compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|file|filesystem|blob):|data:image\//);
			// Setup routing
			$routeProvider.when("/:room*", {});
			// Use HTML5 routing.
			$locationProvider.html5Mode(true);
		}]);

		app.run(["$rootScope", "$timeout", "mediaStream", "translation", "continueConnector", function($rootScope, $timeout, mediaStream, translation, continueConnector) {
			translation.inject($rootScope);
			console.log("Initializing ...");
			var initialize = continueConnector.defer();
			mediaStream.initialize($rootScope, translation);
			$timeout(function() {
				console.log("Initializing complete.")
				initialize.resolve();
			}, 0);
		}]);

		app.constant("availableLanguages", languages);

		app.provider("translationData", function translationDataProvider() {

			// Make available functions for config phase.
			this.add = _.bind(translationData.add, translationData);
			this.load = _.bind(translationData.load, translationData);
			this.language = _.bind(translationData.language, translationData);
			this.default_language = _.bind(translationData.default_language, translationData);

			// Out creater returns raw data.
			this.$get = [function translationDataFactory() {
				return translationData.get();
			}];

		});

		app.directive("spreedWebrtc", [function() {
			return {
				restrict: "A",
				scope: false,
				controller: "AppController"
			}
		}]);

		app.directive("uiLogo", ["globalContext", function(globalContext) {
			return {
				restrict: "A",
				link: function($scope, $element, $attrs) {
					$attrs.$set("title", globalContext.Cfg.Title || "");
				}
			}
		}]);

		return app;

	};

	// Our client side API version as float. This value is incremented on
	// breaking changes to plugins can check on it.
	var apiversion = 1.1;

	var initialize = function(app, launcher) {

		var deferred = launcher.$q.defer();

		var globalContext = JSON.parse(document.getElementById("globalcontext").innerHTML);
		if (!globalContext.Cfg.Version) {
            globalContext.Cfg.Version = "unknown";
        }
		app.constant("globalContext", globalContext);

		// Configure language.
		var lang = (function() {

			var lang = "en";
			var wanted = [];
			var addLanguage = function(l) {
				wanted.push(l);
				if (l.indexOf("-") != -1) {
					wanted.push(l.split("-")[0]);
				}
			};

			// Get from storage.
			if (modernizr.localstorage) {
				var lsl = localStorage.getItem("mediastream-language");
				if (lsl && lsl !== "undefined") {
					wanted.push(lsl);
				}
			}

			// Get from query.
			var qsl = urlQuery.lang;
			if (qsl) {
				addLanguage(qsl);
			}

			// Get from server side configuration (As provided by browser).
			_.each(globalContext.Languages, addLanguage);

			// Loop through requested languages and use first one we have.
			for (var i = 0; i < wanted.length; i++) {
				if (languages.hasOwnProperty(wanted[i])) {
					lang = wanted[i];
					break;
				}
			}

			// Storage at DOM.
			var html = document.getElementsByTagName("html")[0];
			html.setAttribute("lang", lang);

			return lang;

		}());
		console.info("Selected language: "+lang);

		// Set language and load default translations.
		launcher.translationData.lang = lang;
		var translationDomain = "messages";
		if (lang === launcher.translationData.default_lang) {
			// No need to load default language as it is built in.
			launcher.translationData.add(translationDomain, null);
			deferred.resolve();
		} else {
			// Load default translation catalog.
			var url = require.toUrl('translation/'+translationDomain+"-"+lang+'.json');
			launcher.translationData.load(translationDomain, url).then(function() {
				deferred.resolve();
			}, function() {
				// Ignore errors.
				deferred.resolve();
			});
		}

		// Set momemt language.
		moment.lang(lang);

		return deferred.promise;

	};

	return {
		create: create,
		initialize: initialize,
		query: urlQuery,
		config: appConfig,
		apiversion: apiversion
	};

});
