/**
 * Copyright (C) 2015 Joe Bandenburg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function (root, factory) {
    "use strict";
    if (typeof define === "function" && define.amd) {
        define("axolotl-crypto", ["axolotlCryptoCurve25519"], factory);
    } else if (typeof exports === "object") {
        module.exports = factory(require("axolotlCryptoCurve25519"));
    } else {
        root.axolotlCrypto = factory(root.axolotlCryptoCurve25519);
    }
}(this, function(curve25519) {
    "use strict";

    var padding = new Uint8Array([16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]);

    var crypto = {
        generateKeyPair: function() {
            var privateKey = window.crypto.getRandomValues(new Uint8Array(32)).buffer;
            var pair = curve25519.generateKeyPair(privateKey);
            var publicKey = new Uint8Array(33);
            publicKey[0] = 0x05;
            publicKey.set(new Uint8Array(pair.public), 1);
            return {
                public: publicKey.buffer,
                private: pair.private
            };
        },
        calculateAgreement: function(publicKey, privateKey) {
            return curve25519.calculateAgreement(publicKey.slice(1), privateKey);
        },
        randomBytes: function(byteCount) {
            return window.crypto.getRandomValues(new Uint8Array(byteCount)).buffer;
        },
        sign: function(privateKey, dataToSign) {
            return curve25519.sign(privateKey, dataToSign);
        },
        verifySignature: function(signerPublicKey, dataToSign, purportedSignature) {
            return curve25519.verifySignature(signerPublicKey.slice(1), dataToSign, purportedSignature);
        },
        hmac: function(key, data) {
            var keyOptions = {
                name: "HMAC",
                hash: {
                    name: "SHA-256"
                }
            };
            var signOptions = {
                name: "HMAC",
                hash: "SHA-256"
            };
            return window.crypto.subtle.importKey("raw", key, keyOptions, false, ["sign"]).then(function(key) {
                return window.crypto.subtle.sign(signOptions, key, data);
            });
        },
        encrypt: function(key, message, iv) {
            var keyOptions = {
                name: "AES-CBC"
            };
            var encryptOptions = {
                name: "AES-CBC",
                iv: new Uint8Array(iv)
            };
            return window.crypto.subtle.importKey("raw", key, keyOptions, false, ["encrypt"]).then(function(key) {
                return window.crypto.subtle.encrypt(encryptOptions, key, message);
            });
        },
        decrypt: function(key, ciphertext, iv) {
            var keyOptions = {
                name: "AES-CBC"
            };
            var decryptOptions = {
                name: "AES-CBC",
                iv: new Uint8Array(iv)
            };
            return window.crypto.subtle.importKey("raw", key, keyOptions, false, ["decrypt"]).then(function(key) {
                return window.crypto.subtle.decrypt(decryptOptions, key, ciphertext);
            });
        }
    };
    return crypto;
}));
