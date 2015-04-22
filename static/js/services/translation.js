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
define(["jed", "underscore"], function(Jed, _) {

	var TranslationScope = function(service, context, domain) {

		var i18n = service.i18n;

		// _
		this._ = _.bind(function() {
			if (domain && context) {
				return _.bind(function(singular) {
					var vars = Array.prototype.slice.call(arguments, 1);
					var r = i18n.translate(singular).onDomain(domain).withContext(context);
					return r.fetch.apply(r, vars);
				}, this);
			} else if (domain) {
				return _.bind(function(singular) {
					var vars = Array.prototype.slice.call(arguments, 1);
					var r = i18n.translate(singular).onDomain(domain);
					return r.fetch.apply(r, vars);
				}, this);
			} else if (context) {
				return _.bind(function(singular) {
					var vars = Array.prototype.slice.call(arguments, 1);
					var r = i18n.translate(singular).withContext(context);
					return r.fetch.apply(r, vars);
				}, this);
			} else {
				return _.bind(function(singular) {
					var vars = Array.prototype.slice.call(arguments, 1);
					var r = i18n.translate(singular);
					return r.fetch.apply(r, vars);
				}, this);
			}
		}, this)();

		// _n
		this._n = _.bind(function() {
			if (domain && context) {
				return _.bind(function(singular, plural) {
					var vars = Array.prototype.slice.call(arguments, 2);
					var r = i18n.translate(singular).onDomain(domain).withContext(context).ifPlural(vars[0], plural);
					return r.fetch.apply(r, vars);
				});
			} else if (domain) {
				return _.bind(function(singular, plural) {
					var vars = Array.prototype.slice.call(arguments, 2);
					var r = i18n.translate(singular).onDomain(domain).ifPlural(vars[0], plural);
					return r.fetch.apply(r, vars);
				});
			} else if (context) {
				return _.bind(function(singular, plural) {
					var vars = Array.prototype.slice.call(arguments, 2);
					var r = i18n.translate(singular).withContext(context).ifPlural(vars[0], plural);
					return r.fetch.apply(r, vars);
				});
			} else {
				return _.bind(function(singular, plural) {
					var vars = Array.prototype.slice.call(arguments, 2);
					var r = i18n.translate(singular).ifPlural(vars[0], plural);
					return r.fetch.apply(r, vars);
				})
			}
		}, this)();

	};

	var TranslationService = function(translationData) {
		this.i18n = new Jed(translationData);
		var ts = new TranslationScope(this);
		this._ = _.bind(ts._, ts);
		this._n = _.bind(ts._n, ts);
	};

	TranslationService.prototype.inject = function(obj, context, domain) {
		// Inject our functions into objects.
		var ts = new TranslationScope(this, context, domain);
		obj._ = _.bind(ts._, ts);
		obj._n = _.bind(ts._n, ts);
		//console.log("Injected translation service", ts, obj);
		return obj;
	};

	return ["translationData", function(translationData) {
		var translationService = new TranslationService(translationData);
		return translationService;
	}];

});
