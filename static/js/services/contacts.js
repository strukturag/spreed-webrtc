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
define(['underscore', 'jquery', 'modernizr', 'sjcl', 'text!partials/contactsmanager.html', 'text!partials/contactsmanageredit.html'], function(_, $, Modernizr, sjcl, templateContactsManager, templateContactsManagerEdit) {

	var Database = function(name) {
		this.version = 3;
		this.ready = false;
		this.db = null;
		this.name = name;
		this.e = $({});
		var request = window.indexedDB.open(this.name, this.version);
		var that = this;
		request.onupgradeneeded = function(event) {
			var db = event.target.result;
			var transaction = event.target.transaction;
			transaction.onerror = _.bind(that.onerror, that);
			that.init(db);
			console.info("Created contacts database.")
		};
		request.onsuccess = _.bind(that.onsuccess, that);
		request.onerror = _.bind(that.onerror, that);
	};
	Database.prototype.init = function(db) {
		var createOrUpdateStore = function(name, obj) {
			if (db.objectStoreNames.contains(name)) {
				// TODO(longsleep): Migrate data.
				db.deleteObjectStore(name);
			}
			db.createObjectStore(name, obj);
		}
		// Create our object stores.
		createOrUpdateStore("contacts", {
			// We use id field as our unique identifier.
			keyPath: "id"
		});
	};
	Database.prototype.onerror = function(event) {
		console.log("IndexDB database error", event);
	};
	Database.prototype.onsuccess = function(event) {
		this.db = event.target.result;
		this.ready = true;
		//console.log("Openend database", this.db);
		this.e.triggerHandler("ready");
	};
	Database.prototype.put = function(storename, data, successCallback, errorCallback) {
		var transaction = this.db.transaction(storename, "readwrite");
		var store = transaction.objectStore(storename);
		var request = store.put(data);
		if (!errorCallback) {
			errorCallback = _.bind(this.onerror, this);
		}
		transaction.onerror = request.onerror = errorCallback;
		if (successCallback) {
			request.onsuccess = successCallback;
		}
		return request;
	};
	Database.prototype.delete = function(storename, id, successCallback, errorCallback) {
		var transaction = this.db.transaction(storename, "readwrite");
		var store = transaction.objectStore(storename);
		var request = store.delete(id);
		if (!errorCallback) {
			errorCallback = _.bind(this.onerror, this);
		}
		transaction.onerror = request.onerror = errorCallback;
		if (successCallback) {
			request.onsuccess = successCallback;
		}
		return request;
	};
	Database.prototype.all = function(storename, iteratorCallback, errorCallback) {
		var transaction = this.db.transaction(storename);
		var store = transaction.objectStore(storename);
		var keyRange = window.IDBKeyRange.lowerBound(0);
		var cursorRequest = store.openCursor(keyRange);
		cursorRequest.onsuccess = function(event) {
			var result = event.target.result;
			if (!result) {
				return;
			}
			//console.log("read data idb", result, event);
			iteratorCallback(result.value);
			result.continue();
		};
		if (!errorCallback) {
			errorCallback = _.bind(this.onerror, this);
		}
		transaction.onerror = cursorRequest.onerror = errorCallback;
		return cursorRequest;
	};
	Database.prototype.close = function() {
		// TODO(longsleep): Database close.
		this.e.off();
		if (this.db) {
			this.db.close();
			this.db = null;
			this.ready = false;
		}
		_.defer(_.bind(function() {
			this.e.triggerHandler("closed");
		}, this));
	};

	// contacts
	return ["appData", "contactData", "mediaStream", "$templateCache", "modules", function(appData, contactData, mediaStream, $templateCache, modules) {

		var withContacts = modules.withModule("contacts");

		if (withContacts) {
			// Inject our templates.
			$templateCache.put('/contactsmanager/main.html', templateContactsManager);
			$templateCache.put('/contactsmanager/edit.html', templateContactsManagerEdit);
		}

		var Contacts = function() {

			this.e = $({});
			this.userid = null;
			this.key = null;
			this.database = null;
			this.enabled = withContacts;

			appData.e.on("authenticationChanged", _.bind(function(event, userid, suserid) {
				// TODO(longsleep): Avoid creating empty databases. Create db on store only.
				var database = this.open(userid, suserid);
				if (database && userid) {
					// Load when database is ready and userid is available.
					if (database.ready) {
						_.defer(_.bind(function() {
							if (this.database === database) {
								this.load();
							}
						}, this));
					} else {
						database.e.one("ready", _.bind(function() {
							if (this.database === database) {
								this.load();
							}
						}, this));
					}
				}
			}, this));

		};

		Contacts.prototype.put = function(contact) {

			if (!this.database) {
				console.warn("Unable to put contact as no database is loaded.");
				return;
			}
			this.database.put("contacts", {
				id: this.id(contact.Userid),
				contact: this.encrypt(contact)
			});

		};

		Contacts.prototype.open = function(userid, suserid) {

			if (!this.enabled) {
				return null;
			}

			if (this.database && (!userid || this.userid !== userid)) {
				// Unload existing contacts.
				this.unload();
				// Close existing database.
				this.database.close();
				this.database = null;
			}
			if (userid) {
				if (!Modernizr.indexeddb) {
					return;
				}
				// Create secure key for hashing and encryption.
				this.key = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(suserid+mediaStream.config.Token));
				// Create database name for user which.
				var id = "mediastream-" + this.id(userid);
				//console.log("Open of database:", id);
				var database = this.database = new Database(id);
				return database;
			} else {
				this.database = null;
				return null;
			}

		};

		Contacts.prototype.id = function(userid) {

			var hmac = new sjcl.misc.hmac(this.key);
			return sjcl.codec.base64.fromBits(hmac.encrypt(userid));

		};

		Contacts.prototype.encrypt = function(data) {

			return sjcl.encrypt(this.key, JSON.stringify(data));

		};

		Contacts.prototype.decrypt = function(data) {

			var result;
			try {
				var s = sjcl.decrypt(this.key, data);
				result = JSON.parse(s);
			} catch(err) {
				console.error("Failed to decrypt contact data", err);
			}
			return result;

		};

		Contacts.prototype.load = function() {
			if (this.database) {
				//console.log("Load contacts from storage", this);
				var remove = [];
				this.database.all("contacts", _.bind(function(data) {
					var d = this.decrypt(data.contact);
					if (d) {
						var contact = contactData.addByData(d);
						this.e.triggerHandler("contactadded", d);
					} else {
						// Remove empty or invalid entries automatically.
						remove.push(data.id);
					}
				}, this));
				// Remove marked entries.
				if (remove.length) {
					_.each(remove, _.bind(function(id) {
						this.database.delete("contacts", id);
					}, this));
				}
			}
		};

		Contacts.prototype.unload = function() {
			contactData.clear(_.bind(function(contact) {
				this.e.triggerHandler("contactremoved", contact);
			}, this));
		};

		Contacts.prototype.add = function(request, status) {
			var contact = contactData.addByRequest(request, status);
			this.e.triggerHandler("contactadded", contact);
			if (this.database) {
				this.put(contact);
			}
		};

		Contacts.prototype.remove = function(userid) {
			var contact = contactData.get(userid);
			//console.log("contacts remove", userid, contact);
			if (contact) {
				contactData.remove(userid);
				if (this.database) {
					this.database.delete("contacts", this.id(userid));
				}
				this.e.triggerHandler("contactremoved", contact);
			}
		};

		Contacts.prototype.update = function(contact) {
			this.put(contact);
			//console.log("contact update", contact);
			this.e.triggerHandler("contactupdated", contact);
		};

		return new Contacts();

	}];

});
