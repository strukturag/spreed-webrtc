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
define(['underscore'], function(_) {

	// buddyData
	return ["appData", "contactData", "mediaStream", "$rootScope", function(appData, contactData, mediaStream, $rootScope) {

		var scopes = {};
		var brain = {};
		var pushed = {};
		var attestations = {};
		var fakes = {};
		var count = 0;

		var buddyData = {
			clear: function() {
				_.each(scopes, function(scope, id) {
					scope.$destroy();
					brain[id] = scope;
				});
				scopes = {};
			},
			push: function(id) {
				var entry = pushed[id];
				if (!entry) {
					var scope = scopes[id];
					if (scope) {
						entry = pushed[id] = {
							count: 1,
							scope: scopes[id]
						};
					} else {
						return 0;
					}
				} else {
					entry.count++;
				}
				//console.log("pushed buddy", id, entry);
				return entry.count;
			},
			pop: function(id) {
				var entry = pushed[id];
				//console.log("popped buddy", id, entry);
				if (entry) {
					entry.count--;
					if (entry.count <= 0) {
						delete pushed[id];
					}
					return entry.count;
				}
				return 0;
			},
			get: function(id, createInParent, afterCreateCallback, userid) {
				if (scopes.hasOwnProperty(id)) {
					//console.log("found id scope", id);
					return scopes[id];
				} else if (!createInParent && pushed.hasOwnProperty(id)) {
					return pushed[id].scope;
				} else {
					var scope;
					if (userid && scopes.hasOwnProperty(userid)) {
						scope = scopes[userid];
						if (createInParent) {
							scopes[id] = scope;
						}
						//console.log("found userid scope", userid);
						return scope;
					}
					if (createInParent) {
						//console.log("creating scope", id, userid);
						// If we have a parent we can create a new scope.
						scope = scopes[id] = createInParent.$new();
						if (userid) {
							scopes[userid] = scope;
						}
						scope.buddyIndex = ++count;
						if (userid) {
							scope.contact = contactData.get(userid);
						} else {
							scope.contact = null;
						}
						scope.buddyIndexSortable = ("0000000" + scope.buddyIndex).slice(-7);
						if (pushed.hasOwnProperty(id)) {
							// Refresh pushed scope reference.
							pushed[id].scope = scope;
						}
						if (afterCreateCallback) {
							afterCreateCallback(scope);
						}
						return scope;
					} else {
						return null;
					}
				}
			},
			lookup: function(id, onlyactive, withfakes) {
				if (!id) {
					return;
				}
				if (scopes.hasOwnProperty(id)) {
					return scopes[id];
				} else if (!onlyactive) {
					if (brain.hasOwnProperty(id)) {
						return brain[id];
					} else if (pushed.hasOwnProperty(id)) {
						return pushed[id].scope;
					}
					if (withfakes) {
						var fake = fakes[id];
						//console.log("check fake", id, fake);
						if (fake) {
							//console.log("found fake", fake);
							if (fake.display) {
								return fake;
							}
						} else {
							if (attestations.hasOwnProperty(id)) {
								// Fetch with help of session attestation token.
								fake = fakes[id] = {};
								var token = attestations[id].a;
								//console.log("attestation request", id);
								mediaStream.api.sendSessions(token, "session", function(event, type, data) {
									//console.log("attestation session response", id, type, data);
									if (data.Users && data.Users.length > 0) {
										var s = data.Users[0];
										fake.display = {
											displayName: s.Status.displayName
										}
										// TODO(longsleep): Find a better way to apply this than digest on root scope.
										$rootScope.$digest();
									}
								});
							}
						}
					}
				}
				return null;
			},
			del: function(id, hard) {
				var scope = scopes[id];
				if (scope) {
					if (!hard) {
						brain[id] = scope;
					}
					delete scopes[id];
					return scope;
				} else {
					return null;
				}
			},
			set: function(id, scope) {
				scopes[id] = scope;
			},
			attestation: function(id) {
				var data = attestations[id];
				if (data) {
					return data.a;
				}
				return null;
			}
		};

		// attestation support
		(function() {

			// Listen for attestation events.
			mediaStream.api.e.on("received.attestation", function(event, from, attestation) {

				var data = appData.get();
				if (data && data.id === from) {
					// Ignore own id.
					return;
				}

				var current = attestations[from];
				var create = false;
				if (!current) {
					create = true;
				} else {
					if (current.a !== attestation) {
						create = true;
					}
				}
				if (create) {
					//console.log("Created attestation entry", from);
					attestations[from] = {
						a: attestation,
						t: (new Date().getTime())
					}
				}

			});

			var expire = function() {
				var expired = (new Date().getTime()) - 240000;
				_.each(attestations, function(data, id) {
					if (data.t < expired) {
						delete attestations[id];
						//console.log("expired attestation", id);
					}
				})
				setTimeout(expire, 120000);
			};
			expire();

		})();

		return buddyData;

	}];

});
