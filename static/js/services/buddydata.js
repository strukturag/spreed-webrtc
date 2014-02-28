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
define(['underscore'], function(underscore) {

    // buddyData
    return [function() {

        var scopes = {};
        var brain = {};
        var pushed = {};
        var count = 0;

        var buddyData = {
            clear: function() {
                 _.each(scopes, function(scope, id) {
                    scope.$destroy();
                    brain[id]=scope;
                });
                scopes = {};
            },
            push: function(id) {
                var entry = pushed[id];
                if (!entry) {
                    entry = pushed[id] = {count: 1, scope: scopes[id]};
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
            get: function(id, createInParent, afterCreateCallback) {
                if (scopes.hasOwnProperty(id)) {
                    return scopes[id];
                } else if (!createInParent && pushed.hasOwnProperty(id)) {
                    return pushed[id].scope;
                } else {
                    if (createInParent) {
                        // If we have a parent we can create a new scope.
                        var scope = scopes[id] = createInParent.$new();
                        scope.buddyIndex = ++count;
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
            lookup: function(id, onlyactive) {
                var scope = null;
                if (scopes.hasOwnProperty(id)) {
                    scope = scopes[id];
                } else if (!onlyactive) {
                    if (brain.hasOwnProperty(id)) {
                        scope = brain[id];
                    } else if (pushed.hasOwnProperty(id)) {
                        scope = pushed[id].scope;
                    }
                }
                return scope;
            },
            del: function(id, hard) {
                var scope = scopes[id];
                if (scope) {
                    scope.$destroy();
                    brain[id]=scope;
                    delete scopes[id];
                    return scope;
                } else {
                    return null;
                }
            }
        };
        return buddyData;

    }];

});
