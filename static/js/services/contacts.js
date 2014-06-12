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
define(['underscore', 'jquery', 'modernizr', 'sjcl'], function(underscore, $, Modernizr, sjcl) {

	var Database = function(name) {
		this.version = 3;
		this.ready = false;
		this.db = null;
		this.name = name;
		this.e = $({});
		var request = indexedDB.open(this.name, this.version);
		var that = this;
		request.onupgradeneeded = function(event) {
			var db = event.target.result;
			var transaction = event.target.transaction;
			transaction.onerror = _.bind(that.onerror, that);
			that.init(db);
			console.log("Created contacts database.")
		};
		request.onsuccess = _.bind(that.onsuccess, that);
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
		console.log("Openend database", this.db);
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
		var keyRange = IDBKeyRange.lowerBound(0);
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
	return ["appData", "contactData", function(appData, contactData) {

		var Contacts = function() {

			this.e = $({});
			this.userid = null;
			this.database = null;

			appData.e.on("authenticationChanged", _.bind(function(event, userid) {
				var database = this.open(userid);
				if (database && userid) {
					// TODO(longsleep): This needs to be delayed util self has ha userid.
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

		Contacts.prototype.open = function(userid) {

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
				// Create HMAC database name for user.
				var hmac = new sjcl.misc.hmac('mediastream');
				var id = "mediastream-"+sjcl.codec.base64.fromBits(hmac.encrypt(userid));
				console.log("Open of database:", id);
				var database = this.database = new Database(id);
				return database;
			} else {
				this.database = null;
				return null;
			}

		};

		Contacts.prototype.load = function() {
			if (this.database) {
				console.log("Load contacts from storage", this);
				this.database.all("contacts", _.bind(function(data) {
					var contact = contactData.addByData(data.contact);
					// TODO(longsleep): Convert buddyImage string to Blob.
					this.e.triggerHandler("contactadded", contact);
				}, this));
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
				this.database.put("contacts", {
					id: contact.Userid,
					contact: contact
				})
			}
		};

		Contacts.prototype.remove = function(userid) {
			var contact = contactData.get(userid);
			console.log("contacts remove", userid, contact);
			if (contact) {
				contactData.remove(userid);
				if (this.database) {
					this.database.delete("contacts", userid);
				}
				this.e.triggerHandler("contactremoved", contact);
			}
		};

		return new Contacts();

	}];

});
