/*
 * Spreed Speak Freely.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed Speak Freely.
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

    'ui-bootstrap',
    'angular-sanitize',
    'angular-animate',
    'angular-humanize',
    'angular-route',
    'mobile-events',
    'dialogs'

], function(require, $, _, angular, modernizr, moment, services, directives, filters, controllers) {

    var initialize = function() {

        var app = angular.module('app', ['ui.bootstrap', 'ngSanitize', 'ngAnimate', 'ngHumanize', 'ngRoute', 'dialogs']);
        services.initialize(app);
        directives.initialize(app);
        filters.initialize(app);
        controllers.initialize(app);

        app.config(["$compileProvider", "$locationProvider", "$routeProvider", function($compileProvider, $locationProvider, $routeProvider) {
            // Allow angular to use filesystem: hrefs which would else be prefixed with unsafe:.
            $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|filesystem|blob):/);
            $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|file|filesystem|blob):|data:image\//);
            // Setup routing
            $routeProvider.when("/:room", {});
            // Use HTML5 routing.
            $locationProvider.html5Mode(true);
        }]);

        app.run(["$rootScope", "mediaStream", "translation", function($rootScope, mediaStream, translation) {
            translation.inject($rootScope);
            console.log("Initializing ...");
            mediaStream.initialize($rootScope, translation);
        }]);

        angular.element(document).ready(function() {

            // Detect language.
            var lang = (function() {
                var lang;
                var html = document.getElementsByTagName("html")[0];
                if (modernizr.localstorage) {
                    lang = localStorage.getItem("mediastream-language");
                    if (!lang || lang === "undefined") {
                        lang = null;
                    }
                }
                if (lang) {
                    html.setAttribute("lang", lang);
                    return lang;
                } else {
                    try {
                        return html.getAttribute("lang");
                    } catch(e) {
                        return "en";
                    };
                }
            }());

            // Prepare bootstrap function with injected locale data.
            var domain = "messages";
            var catalog = domain + "-" + lang;
            var bootstrap = function(translationData) {
                if (translationData) {
                    // Set loaded translation data.
                    translationData.missing_key_callback = function(key) {
                        console.warn("Missing key " + key + " for " + lang);
                    };
                } else {
                    // Fallback catalog in case translation could not be loaded.
                    lang = "en";
                    translationData = {};
                    translationData.locale_data = {};
                    translationData.domain = domain;
                    translationData.locale_data[domain] = {
                        "": {
                            "domain": domain,
                            "lang": lang,
                            "plural_forms" : "nplurals=2; plural=(n != 1);"
                        }
                    }
                }
                // Set date language too.
                moment.lang([lang, "en"]);
                // Inject translation data globally.
                app.constant("translationData", translationData);
                // Bootstrap AngularJS app.
                console.log("Bootstrapping ...");
                angular.bootstrap(document, ['app']);
            }

            if (lang !== "en") {
                // Load translation file.
                //console.log("Loading translation data: " + lang);
                $.ajax({
                    dataType: "json",
                    url: require.toUrl('translation/'+catalog+'.json'),
                    success: function(data) {
                        //console.log("Loaded translation data.");
                        bootstrap(data);
                    },
                    error: function(err, textStatus, errorThrown)  {
                        console.warn("Failed to load translation data " + catalog + ": "+ errorThrown);
                        bootstrap(null);
                    }
                });
            } else {
                // No need to load english as this is built in.
                bootstrap();
            }

        });

        return app;

    };

    return {
        initialize: initialize
    };

});
