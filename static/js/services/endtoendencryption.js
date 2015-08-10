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
	'jquery',
	'underscore',
	'modernizr',
	'axolotl',
	'ByteBuffer'
], function(
	$,
	_,
	modernizr,
	axolotl,
	ByteBuffer
) {

	return [
		"$window",
		"$q",
		function(
			$window,
			$q
		) {

		// Bitflags for the different components that need to be ready for
		// encryption to work.
		var READY_NONE = 0;
		var READY_IDENTITY_KEYPAIR = 1;
		var READY_REGISTRATION_ID = 2;
		var READY_LAST_RESORT_PRE_KEY = 4;

		var READY_ALL = READY_IDENTITY_KEYPAIR |
						READY_REGISTRATION_ID |
						READY_LAST_RESORT_PRE_KEY;

		var LAST_RESORT_PRE_KEY_ID = 0xffffffff;

		var deserializeKeypair = function(data) {
			if (typeof(data) === "string") {
				data = JSON.parse(data);
			}
			return {
				"private": ByteBuffer.fromBase64(data.private).toArrayBuffer(),
				"public": ByteBuffer.fromBase64(data.public).toArrayBuffer()
			};
		};

		var deserializePublicKey = function(data) {
			return ByteBuffer.fromBase64(data).toArrayBuffer();
		};

		var deserializeSignature = function(data) {
			return ByteBuffer.fromBase64(data).toArrayBuffer();
		};

		var deserializeSignedPreKey = function(data) {
			if (typeof(data) === "string") {
				data = JSON.parse(data);
			}
			return {
				"id": parseInt(data.id, 10),
				"keyPair": {
					"private":
							ByteBuffer.fromBase64(data.private).toArrayBuffer(),
					"public":
							ByteBuffer.fromBase64(data.public).toArrayBuffer()
				},
				"signature":
						ByteBuffer.fromBase64(data.signature).toArrayBuffer()
			};
		};

		var serializeKeypair = function(keypair) {
			var data = {
				"private": ByteBuffer.wrap(keypair.private).toBase64(),
				"public": ByteBuffer.wrap(keypair.public).toBase64()
			};
			return JSON.stringify(data);
		};

		var serializePublicKey = function(keypair) {
			return ByteBuffer.wrap(keypair.public).toBase64();
		};

		var serializeSignature = function(signature) {
			return ByteBuffer.wrap(signature).toBase64();
		};

		var serializeSignedPreKey = function(key) {
			var data = {
				"id": key.id,
				"private": ByteBuffer.wrap(key.keyPair.private).toBase64(),
				"public": ByteBuffer.wrap(key.keyPair.public).toBase64(),
				"signature": ByteBuffer.wrap(key.signature).toBase64()
			};
			return JSON.stringify(data);
		};

		var LocalStorageDataStore = function(endToEndEncryption) {
			this.e = $({});
			this.endToEndEncryption = endToEndEncryption;
			this.userid = null;
			this.id = endToEndEncryption.api.sid;
			this.anonymous_storage = {};
			endToEndEncryption.api.e.on("received.self", _.bind(function(event, data) {
				var userid = data.Suserid || null;
				if (this.id === (userid || data.Sid) && this.userid === userid) {
					return;
				}
				var initial = (this.id === null);
				this.id = userid || data.Sid;
				if (this.userid !== userid) {
					this.userid = userid;
					this.anonymous_storage = {};
				}
				this.endToEndEncryption.resetStore();
				if (initial) {
					this.e.triggerHandler("ready");
				}
			}, this));
			this.storage = $window.localStorage;
		};

		LocalStorageDataStore.prototype.isReady = function() {
			return !!this.id;
		};

		LocalStorageDataStore.prototype.load = function(key) {
			if (!this.id) {
				// Not connected, unknown user state.
				return null;
			} else if (!this.userid) {
				// Connected, but not logged in.
				return this.anonymous_storage[key] || null;
			} else {
				// Connected, logged in.
				return this.storage.getItem(key);
			}
		};

		LocalStorageDataStore.prototype.save = function(key, data) {
			if (!this.id) {
				return false;
			} else if (!this.userid) {
				this.anonymous_storage[key] = data;
				return true;
			}
			switch (typeof(data)) {
			case "string":
				break;
			case "number":
				data = data.toString();
				break;
			default:
				data = JSON.stringify(data);
			}
			this.storage.setItem(key, data);
			return true;
		};

		LocalStorageDataStore.prototype.loadKeypair = function() {
			var data = this.load("keypair_" + this.id);
			if (!data) {
				return null;
			}

			return deserializeKeypair(data);
		};

		LocalStorageDataStore.prototype.loadRegistrationId = function() {
			var data = this.load("registration_id_" + this.id);
			if (!data) {
				return null;
			}

			return parseInt(data, 10);
		};

		LocalStorageDataStore.prototype.loadNextSignedPreKeyId = function() {
			var data = this.load("next_signed_pre_key_id_" + this.id);
			if (!data) {
				return null;
			}

			return parseInt(data, 10);
		};

		LocalStorageDataStore.prototype.loadSignedPreKey = function(id) {
			var data = this.load("signed_pre_key_" + this.id + "_" + id);
			if (!data) {
				return null;
			}

			return deserializeSignedPreKey(data);
		};

		LocalStorageDataStore.prototype.saveKeypair = function(keypair) {
			var data = serializeKeypair(keypair);
			return this.save("keypair_" + this.id, data);
		};

		LocalStorageDataStore.prototype.saveRegistrationId = function(id) {
			return this.save("registration_id_" + this.id, id);
		};

		LocalStorageDataStore.prototype.saveNextSignedPreKeyId = function(id) {
			return this.save("next_pre_key_id_" + this.id, id);
		};

		LocalStorageDataStore.prototype.saveSignedPreKey = function(key) {
			var data = serializeSignedPreKey(key);
			return this.save("signed_pre_key_" + this.id + "_" + key.id, data);
		};

		var EndToEndEncryption = function(api) {
			this.e = $({});
			this.api = api;
			// TODO(fancycode): Look into using IndexedDB as storage backend.
			if (modernizr.localstorage) {
				this.store = new LocalStorageDataStore(this);
			} else {
				// Need a way to store data for encryption support.
				return;
			}

			this.axol = axolotl({
				getLocalIdentityKeyPair: _.bind(function() {
					return this.getLocalIdentityKeyPair.apply(this, arguments);
				}, this),
				getLocalRegistrationId: _.bind(function() {
					return this.getLocalRegistrationId.apply(this, arguments);
				}, this),
				getLocalSignedPreKeyPair: _.bind(function() {
					return this.getLocalSignedPreKeyPair.apply(this, arguments);
				}, this),
				getLocalPreKeyPair: _.bind(function() {
					// Unsigned PreKeys are only used by protocol V2.
					console.warn("Local PreKeys are not supported.")
					return null;
				}, this)
			});
			this.api.e.on("received.requestkeybundle",
					_.bind(function(event, peer) {
				this.requestKeyBundle(peer);
			}, this))
			this.api.e.on("received.keybundle",
					_.bind(function(event, peer, data) {
				this.receivedKeyBundle(peer, data);
			}, this))
			this.peer_identities = {};
			this.sessions = {};
			this.resetStore();
		};

		EndToEndEncryption.prototype.isSupported = function() {
			return !!this.store;
		};

		EndToEndEncryption.prototype.resetStore = function() {
			// TODO(fancycode): We should process any pending messages before
			// resetting everything.
			this.identity_keypair = null;
			this.registration_id = null;
			this.last_resort_pre_key = null;
			this.next_signed_pre_key_id = 1;
			this.pending_messages = {};
			this.is_processing_messages = {};
			this.ready_promise = null;
			if (this.store.isReady()) {
				_.defer(_.bind(function() {
					this.register();
				}, this));
			}
		};

		EndToEndEncryption.prototype.getIdentityFingerprint = function() {
			return this.formatIdentityFingerprint(this.identity_keypair.public);
		};

		EndToEndEncryption.prototype.formatIdentityFingerprint = function(public_key) {
			// TODO(jojo): Change this to be the SHA-1 hash of a three-byte key
			// id and the public key.
			// See https://github.com/WhisperSystems/TextSecure/blob/08ed90c5ece49c92e35c492afb4e60160983015a/src/org/thoughtcrime/securesms/crypto/PublicKey.java#L95
			var fingerprint = ByteBuffer.wrap(public_key).toHex();
			var pos;
			for (pos = fingerprint.length - 4; pos >= 4; pos -= 4) {
				fingerprint = fingerprint.substr(0, pos) + "-" +
						fingerprint.substr(pos);
			}
			return fingerprint.substr(2);
		};

		EndToEndEncryption.prototype.storePeerIdentity = function(peer, public_key) {
			var fingerprint = this.formatIdentityFingerprint(public_key);
			var existing = this.peer_identities[peer];
			if (existing === fingerprint) {
				return;
			} else if (existing && existing !== fingerprint) {
				console.warn("Fingerprint changed", {
					"peer": peer,
					"existing": existing,
					"fingerprint": fingerprint
				});
			}
			this.peer_identities[peer] = fingerprint;
		};

		EndToEndEncryption.prototype.getReadyPromise = function() {
			if (!this.ready_promise) {
				// Load/create initial objects
				this.ready_promise = this.loadData().then(_.bind(function() {
					var deferred = $q.defer();

					_.defer(_.bind(function() {
						var ready_state = READY_NONE;
						var check_ready = _.bind(function() {
							if (ready_state  === READY_ALL) {
								deferred.resolve();
							}
						}, this);
						this.getLocalIdentityKeyPair().then(function() {
							ready_state |= READY_IDENTITY_KEYPAIR;
							check_ready();
						});
						this.getLocalRegistrationId().then(function() {
							ready_state |= READY_REGISTRATION_ID;
							check_ready();
						});
						this.getLastResortPreKey().then(function() {
							ready_state |= READY_LAST_RESORT_PRE_KEY;
							check_ready();
						});
					}, this));
					return deferred.promise;
				}, this));
			}
			return this.ready_promise;
		};

		EndToEndEncryption.prototype.loadData = function() {
			var deferred = $q.defer();
			var doLoadData = _.bind(function() {
				this.identity_keypair = this.store.loadKeypair();
				this.registration_id = this.store.loadRegistrationId();
				this.last_resort_pre_key =
						this.store.loadSignedPreKey(LAST_RESORT_PRE_KEY_ID);
				this.next_signed_pre_key_id =
						this.store.loadNextSignedPreKeyId();
				if (this.next_signed_pre_key_id === null) {
					this.next_signed_pre_key_id = 1;
				}
				deferred.resolve();
			}, this);
			if (this.store.isReady()) {
				_.defer(doLoadData);
			} else {
				this.store.e.one("ready", doLoadData);
			}
			return deferred.promise;
		};

		EndToEndEncryption.prototype.getLocalIdentityKeyPair = function() {
			var deferred = $q.defer();
			_.defer(_.bind(function() {
				if (this.identity_keypair) {
					deferred.resolve(this.identity_keypair);
					return;
				}

				this.axol.generateIdentityKeyPair()
						.then(_.bind(function(keypair) {
					if (this.identity_keypair === null) {
						this.identity_keypair = keypair;
						this.store.saveKeypair(keypair);
					}
					deferred.resolve(this.identity_keypair);
				}, this));
			}, this));
			return deferred.promise;
		};

		EndToEndEncryption.prototype.getLocalRegistrationId = function() {
			var deferred = $q.defer();
			_.defer(_.bind(function() {
				if (this.registration_id) {
					deferred.resolve(this.registration_id);
					return;
				}

				this.axol.generateRegistrationId().then(_.bind(function(id) {
					if (this.registration_id === null) {
						this.registration_id = id;
						this.store.saveRegistrationId(id);
					}
					deferred.resolve(this.registration_id);
				}, this));
			}, this));
			return deferred.promise;
		};

		EndToEndEncryption.prototype.getLastResortPreKey = function() {
			var deferred = $q.defer();
			_.defer(_.bind(function() {
				if (this.last_resort_pre_key) {
					deferred.resolve(this.last_resort_pre_key);
					return;
				}

				this.getSignedPreKey(LAST_RESORT_PRE_KEY_ID)
						.then(_.bind(function(pre_key) {
					if (this.last_resort_pre_key === null) {
						this.last_resort_pre_key = pre_key;
						this.store.saveSignedPreKey(pre_key);
					}
					deferred.resolve(this.last_resort_pre_key);
				}, this));
			}, this));
			return deferred.promise;
		};

		EndToEndEncryption.prototype.getLocalSignedPreKeyPair = function(id) {
			var deferred = $q.defer();
			_.defer(_.bind(function() {
				var signed_pre_key;
				if (id === LAST_RESORT_PRE_KEY_ID) {
					signed_pre_key = this.last_resort_pre_key;
				} else {
					signed_pre_key = this.store.loadSignedPreKey(id);
				}
				deferred.resolve(signed_pre_key.keyPair || null);
			}, this));
			return deferred.promise;
		};

		EndToEndEncryption.prototype.getSignedPreKey = function(id) {
			if (!id) {
				id = this.next_signed_pre_key_id;
				this.next_signed_pre_key_id++;
				if (this.next_signed_pre_key_id === LAST_RESORT_PRE_KEY_ID) {
					this.next_signed_pre_key_id = 1;
				}
				this.store.saveNextSignedPreKeyId(this.next_signed_pre_key_id);
			}

			var deferred = $q.defer();
			_.defer(_.bind(function() {
				_.defer(_.bind(function() {
					this.axol.generateSignedPreKey(this.identity_keypair, id)
							.then(_.bind(function(signed_pre_key) {
						// Need to remember so it can be looked up later.
						this.store.saveSignedPreKey(signed_pre_key);
						deferred.resolve(signed_pre_key);
					}, this));
				}, this));
			}, this));
			return deferred.promise;
		};

		EndToEndEncryption.prototype.apiSend = function(type, message) {
			var msg = {
				"Type": type
			};
			msg[type] = message;
			this.api.send(type, message);
		};

		EndToEndEncryption.prototype.register = function() {
			this.getReadyPromise().then(_.bind(function() {
				var message = {
					"RegistrationId": this.registration_id,
					"Identity": serializePublicKey(this.identity_keypair),
					"LastResortSignedPreKey": {
						"Id": this.last_resort_pre_key.id,
						"Key": serializePublicKey(
								this.last_resort_pre_key.keyPair),
						"Signature": serializeSignature(
								this.last_resort_pre_key.signature)
					}
				};
				this.apiSend("EncryptionRegister", message);
			}, this));
		};

		EndToEndEncryption.prototype.processPendingMessages = function(peer) {
			var pending = this.pending_messages[peer];
			if (pending && pending.length > 0) {
				var msg = pending.shift();
				switch (msg.type) {
				case "encrypt":
					this.encryptWithSession(
							peer,
							this.sessions[peer],
							msg.message,
							msg.callback);
					break;
				case "decrypt":
					this.decryptWithSession(
							peer,
							this.sessions[peer],
							msg.message,
							msg.callback);
					break;
				}
			} else {
				delete this.is_processing_messages[peer];
				delete this.pending_messages[peer];
			}
		};

		EndToEndEncryption.prototype.requestKeyBundle = function(peer) {
			this.getSignedPreKey().then(_.bind(function(signed_pre_key) {
				var bundle = {
					"To": peer,
					"Identity": serializePublicKey(this.identity_keypair),
					"PreKeyId": null,
					"PreKey": null,
					"SignedPreKeyId": signed_pre_key.id,
					"SignedPreKey":
							serializePublicKey(signed_pre_key.keyPair),
					"SignedPreKeySignature":
							serializeSignature(signed_pre_key.signature)
				};
				this.apiSend("EncryptionKeyBundle", bundle);
			}, this));
		};

		EndToEndEncryption.prototype.receivedKeyBundle = function(peer, data) {
			var bundle = {
				"identityKey": deserializePublicKey(data.Identity),
				"preKeyId": null,
				"preKey": null,
				"signedPreKeyId": null,
				"signedPreKey": null,
				"signedPreKeySignature": null
			};
			if (data.PreKey) {
				bundle.preKeyId = data.PreKeyId;
				bundle.preKey = deserializePublicKey(data.PreKey);
			}
			if (data.SignedPreKey) {
				bundle.signedPreKeyId = data.SignedPreKeyId;
				bundle.signedPreKey = deserializePublicKey(data.SignedPreKey);
				bundle.signedPreKeySignature =
						deserializeSignature(data.SignedPreKeySignature);
			}
			this.storePeerIdentity(peer, bundle.identityKey);
			// TODO(fancycode): Add error handling.
			this.axol.createSessionFromPreKeyBundle(bundle)
					.then(_.bind(function(session) {
				this.sessions[peer] = session;
				this.processPendingMessages(peer);
			}, this));
		};

		EndToEndEncryption.prototype.encrypt = function(peer, type, message, callback) {
			var msg = {"Type": type};
			msg[type] = message;
			message = JSON.stringify(msg);
			if (this.is_processing_messages[peer]) {
				this.pending_messages[peer].push({
					"type": "encrypt",
					"message": message,
					"callback": callback
				});
				return;
			}

			this.is_processing_messages[peer] = true;
			this.pending_messages[peer] = [];
			var session = this.sessions[peer];
			if (!session) {
				this.pending_messages[peer].push({
					"type": "encrypt",
					"message": message,
					"callback": callback
				});
				this.apiSend("EncryptionRequestKeyBundle", {"To": peer});
				return;
			}
			this.encryptWithSession(peer, session, message, callback);
		};

		EndToEndEncryption.prototype.encryptWithSession = function(
				peer, session, message, callback) {
			var buffer = ByteBuffer.fromUTF8(message).toArrayBuffer();
			// TODO(fancycode): Add error handling.
			this.axol.encryptMessage(session, buffer)
					.then(_.bind(function(encrypted) {
				this.sessions[peer] = encrypted.session;
				var msg = {
					"Message": encrypted.isPreKeyWhisperMessage ?
							"PreKeyWhisper" :
							"Whisper",
					"Data": ByteBuffer.wrap(encrypted.body).toBase64()
				};
				callback("Encrypted", msg);
				this.processPendingMessages(peer);
			}, this));
		};

		EndToEndEncryption.prototype.decrypt = function(peer, message, callback) {
			if (this.is_processing_messages[peer]) {
				this.pending_messages[peer].push({
					"type": "decrypt",
					"message": message,
					"callback": callback
				});
				return;
			}
			this.is_processing_messages[peer] = true;
			this.pending_messages[peer] = [];
			var session = this.sessions[peer] || null;
			this.decryptWithSession(peer, session, message, callback);
		};

		EndToEndEncryption.prototype.decryptWithSession = function(
				peer, session, message, callback) {
			var handle_decrypted = _.bind(function(decrypted) {
				if (decrypted.identityKey) {
					this.storePeerIdentity(peer, decrypted.identityKey);
				}
				this.sessions[peer] = decrypted.session;
				var msg = ByteBuffer.wrap(decrypted.message).toUTF8();
				callback(JSON.parse(msg));
				this.processPendingMessages(peer);
			}, this);

			if (typeof(message) === "string") {
				message = JSON.parse(message);
			}
			var buffer = ByteBuffer.fromBase64(message.Data).toArrayBuffer();
			switch (message.Message) {
			case "PreKeyWhisper":
				// TODO(fancycode): Add error handling.
				this.axol.decryptPreKeyWhisperMessage(session, buffer)
					.then(handle_decrypted);
				break;
			case "Whisper":
				// TODO(fancycode): Add error handling.
				this.axol.decryptWhisperMessage(session, buffer)
					.then(handle_decrypted);
				break;
			}
		};

		var endToEndEncryption;

		// Only export limited public encryption API.
		var endToEndEncryptionApi = {
			"initialize": function(api) {
				if (endToEndEncryption) {
					return endToEndEncryption;
				}
				endToEndEncryption = new EndToEndEncryption(api);
				if (!endToEndEncryption.isSupported()) {
					console.warn("EndToEnd encryption services not supported");
					endToEndEncryption = null;
					return null;
				}
				console.log("EndToEnd encryption services initialized");
				return endToEndEncryption;
			},
			"encrypt": function(peer, type, message, callback) {
				if (!endToEndEncryption) {
					callback(type, message);
					return;
				}
				endToEndEncryption.encrypt(peer, type, message, callback);
			},
			"decrypt": function(peer, message, callback) {
				if (!endToEndEncryption) {
					callback(message);
					return;
				}
				endToEndEncryption.decrypt(peer, message, callback);
			}
		};

		return endToEndEncryptionApi;

	}];

});
