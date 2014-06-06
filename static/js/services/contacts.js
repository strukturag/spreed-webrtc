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
define(['underscore', 'jquery', 'modernizr'], function(underscore, $, Modernizr) {

	var Database = function(name, version) {
		this.ready = false;
		this.db = null;
		this.name = name;
		this.e = $({});
		var request = indexedDB.open("mediastream", version);
		var that = this;
		request.onupgradeneeded = function(event) {
			var db = event.target.result;
			var transaction = event.target.transaction;
			transaction.onerror = _.bind(that.onerror, that);
			if (db.objectStoreNames.contains(name)) {
				// TODO(longsleep): Database upgrade should keep the data and migrate it.
				db.deleteObjectStore("contacts")
				console.warn("Removed contacts database with old format.")
			}
			db.createObjectStore(name, {
				// We use id field as our unique identifier.
				keyPath: "id"
			});
			console.log("Created contacts database.")
		};
		request.onsuccess = _.bind(that.onsuccess, that);
	};
	Database.prototype.onerror = function(event) {
		console.log("IndexDB database error", event);
	};
	Database.prototype.onsuccess = function(event) {
		this.db = event.target.result;
		this.ready = true;
		console.log("Openend database for contacts", this.db);
		this.e.triggerHandler("ready");
	};
	Database.prototype.put = function(data, successCallback, errorCallback) {
		var transaction = this.db.transaction(this.name, "readwrite");
		var store = transaction.objectStore(this.name);
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
	Database.prototype.delete = function(id, successCallback, errorCallback) {
		var transaction = this.db.transaction(this.name, "readwrite");
		var store = transaction.objectStore(this.name);
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
	Database.prototype.all = function(iteratorCallback, errorCallback) {
		var transaction = this.db.transaction(this.name);
		var store = transaction.objectStore(this.name);
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

	var database;
	if (Modernizr.indexeddb) {
		database = new Database("contacts", 1);
	}

	// contacts
	return ["appData", "contactData", function(appData, contactData) {

		var Contacts = function() {
			this.e = $({});
			this.userid = null;
			appData.e.on("authenticationChanged", _.bind(function(event, userid) {
				this.userid = userid;
				if (database && userid) {
					// TODO(longsleep): This needs to be delayed util self has ha userid.
					if (database.ready) {
						_.defer(_.bind(this.load, this));
					} else {
						database.e.one("ready", _.bind(this.load, this));
					}
				}
			}, this));
		};

		Contacts.prototype.load = function() {
			console.log("Load contacts from storage", database);
			database.all(_.bind(function(data) {
				var contact = contactData.addByData(data.contact);
				// TODO(longsleep): Convert buddyImage string to Blob.
				this.e.triggerHandler("contactadded", contact);
			}, this));
		};

		Contacts.prototype.add = function(request, status) {
			var contact = contactData.addByRequest(request, status);
			this.e.triggerHandler("contactadded", contact);
			if (database) {
				database.put({
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
				if (database) {
					database.delete(userid);
				}
				this.e.triggerHandler("contactremoved", contact);
			}
		};

		return new Contacts();

	}];

});
