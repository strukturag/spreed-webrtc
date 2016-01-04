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

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'protobufjs',
            'traceur-runtime',
            'axolotl-crypto'
        ], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('protobufjs'), require('traceur/bin/traceur-runtime'), require('axolotl-crypto'));
    } else {
        this.axolotl = factory(dcodeIO.ProtoBuf, 1, axolotlCrypto);
    }
}(function (__external_1, __external_2, __external_axolotlCrypto) {
    var global = this, define;
    function _require(id) {
        var module = _require.cache[id];
        if (!module) {
            var exports = {};
            module = _require.cache[id] = {
                id: id,
                exports: exports
            };
            _require.modules[id].call(exports, module, exports);
        }
        return module.exports;
    }
    _require.cache = [];
    _require.modules = [
        function (module, exports) {
            'use strict';
            var $__src_47_Axolotl__, $__axolotl_45_crypto__;
            var Axolotl = ($__src_47_Axolotl__ = _require(2), $__src_47_Axolotl__ && $__src_47_Axolotl__.__esModule && $__src_47_Axolotl__ || { default: $__src_47_Axolotl__ }).default;
            var axolotlCrypto = ($__axolotl_45_crypto__ = _require(17), $__axolotl_45_crypto__ && $__axolotl_45_crypto__.__esModule && $__axolotl_45_crypto__ || { default: $__axolotl_45_crypto__ }).default;
            module.exports = function (store) {
                return new Axolotl(axolotlCrypto, store);
            };
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__default = {
                    areEqual: function (left, right) {
                        if (left.byteLength !== right.byteLength) {
                            return false;
                        }
                        var leftView = new Uint8Array(left);
                        var rightView = new Uint8Array(right);
                        for (var i = 0; i < left.byteLength; i++) {
                            if (leftView[i] !== rightView[i]) {
                                return false;
                            }
                        }
                        return true;
                    },
                    concat: function () {
                        for (var buffers = [], $__0 = 0; $__0 < arguments.length; $__0++)
                            buffers[$__0] = arguments[$__0];
                        buffers = buffers.length === 1 ? buffers[0] : buffers;
                        var i;
                        var byteLength = 0;
                        for (i = 0; i < buffers.length; i++) {
                            byteLength += buffers[i].byteLength;
                        }
                        var newBuffer = new ArrayBuffer(byteLength);
                        var view = new Uint8Array(newBuffer);
                        var offset = 0;
                        for (i = 0; i < buffers.length; i++) {
                            view.set(new Uint8Array(buffers[i]), offset);
                            offset += buffers[i].byteLength;
                        }
                        return newBuffer;
                    },
                    fromByte: function (byte) {
                        return new Uint8Array([byte]).buffer;
                    },
                    stringify: function (buffer) {
                        var string = '';
                        var view = new Uint8Array(buffer);
                        for (var i = 0; i < buffer.byteLength; i++) {
                            var byte = view[i].toString(16);
                            if (byte.length === 1) {
                                string += '0';
                            }
                            string += byte;
                        }
                        return string;
                    },
                    parse: function (string) {
                        var buffer = new ArrayBuffer(string.length / 2);
                        var view = new Uint8Array(buffer);
                        for (var i = 0; i < string.length; i += 2) {
                            view[i / 2] = parseInt(string[i], 16) * 16 + parseInt(string[i + 1], 16);
                        }
                        return buffer;
                    }
                };
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__SessionFactory__, $__SessionCipher__, $__Exceptions__, $__Store__, $__Crypto__, $__co__, $__axolotl_45_crypto__;
            var SessionFactory = ($__SessionFactory__ = _require(13), $__SessionFactory__ && $__SessionFactory__.__esModule && $__SessionFactory__ || { default: $__SessionFactory__ }).default;
            var SessionCipher = ($__SessionCipher__ = _require(12), $__SessionCipher__ && $__SessionCipher__.__esModule && $__SessionCipher__ || { default: $__SessionCipher__ }).default;
            var InvalidMessageException = ($__Exceptions__ = _require(5), $__Exceptions__ && $__Exceptions__.__esModule && $__Exceptions__ || { default: $__Exceptions__ }).InvalidMessageException;
            var Store = ($__Store__ = _require(15), $__Store__ && $__Store__.__esModule && $__Store__ || { default: $__Store__ }).default;
            var Crypto = ($__Crypto__ = _require(4), $__Crypto__ && $__Crypto__.__esModule && $__Crypto__ || { default: $__Crypto__ }).default;
            var co = ($__co__ = _require(18), $__co__ && $__co__.__esModule && $__co__ || { default: $__co__ }).default;
            var axolotlCrypto = ($__axolotl_45_crypto__ = _require(17), $__axolotl_45_crypto__ && $__axolotl_45_crypto__.__esModule && $__axolotl_45_crypto__ || { default: $__axolotl_45_crypto__ }).default;
            function Axolotl(crypto, store) {
                var self = this;
                var wrappedStore = new Store(store);
                var wrappedCrypto = new Crypto(crypto);
                var sessionFactory = new SessionFactory(wrappedCrypto, wrappedStore);
                var sessionCipher = new SessionCipher(wrappedCrypto);
                this.generateIdentityKeyPair = function () {
                    return wrappedCrypto.generateKeyPair();
                };
                this.generateRegistrationId = co.wrap($traceurRuntime.initGeneratorFunction(function $__9(extendedRange) {
                    var upperLimit, bytes, number;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                upperLimit = extendedRange ? 2147483646 : 16380;
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.state = 2;
                                return wrappedCrypto.randomBytes(4);
                            case 2:
                                bytes = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                number = new Uint32Array(bytes)[0];
                                $ctx.state = 10;
                                break;
                            case 10:
                                $ctx.returnValue = number % upperLimit + 1;
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__9, this);
                }));
                this.generatePreKeys = co.wrap($traceurRuntime.initGeneratorFunction(function $__10(start, count) {
                    var results, i, $__11, $__12, $__13, $__14, $__15, $__16;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                results = [];
                                start--;
                                $ctx.state = 15;
                                break;
                            case 15:
                                i = 0;
                                $ctx.state = 11;
                                break;
                            case 11:
                                $ctx.state = i < count ? 5 : 9;
                                break;
                            case 8:
                                i++;
                                $ctx.state = 11;
                                break;
                            case 5:
                                $__11 = results.push;
                                $__12 = wrappedCrypto.generateKeyPair;
                                $__13 = $__12.call(wrappedCrypto);
                                $ctx.state = 6;
                                break;
                            case 6:
                                $ctx.state = 2;
                                return $__13;
                            case 2:
                                $__14 = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $__15 = {
                                    id: (start + i) % 16777214 + 1,
                                    keyPair: $__14
                                };
                                $__16 = $__11.call(results, $__15);
                                $ctx.state = 8;
                                break;
                            case 9:
                                $ctx.returnValue = results;
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__10, this);
                }));
                this.generateLastResortPreKey = co.wrap($traceurRuntime.initGeneratorFunction(function $__17() {
                    var $__18, $__19, $__20, $__21;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $__18 = wrappedCrypto.generateKeyPair;
                                $__19 = $__18.call(wrappedCrypto);
                                $ctx.state = 6;
                                break;
                            case 6:
                                $ctx.state = 2;
                                return $__19;
                            case 2:
                                $__20 = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $__21 = {
                                    id: 16777215,
                                    keyPair: $__20
                                };
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.returnValue = $__21;
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__17, this);
                }));
                this.generateSignedPreKey = co.wrap($traceurRuntime.initGeneratorFunction(function $__22(identityKeyPair, signedPreKeyId) {
                    var keyPair, signature;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $ctx.state = 2;
                                return wrappedCrypto.generateKeyPair();
                            case 2:
                                keyPair = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $ctx.state = 6;
                                return wrappedCrypto.sign(identityKeyPair.private, keyPair.public);
                            case 6:
                                signature = $ctx.sent;
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.returnValue = {
                                    id: signedPreKeyId,
                                    keyPair: keyPair,
                                    signature: signature
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__22, this);
                }));
                this.createSessionFromPreKeyBundle = sessionFactory.createSessionFromPreKeyBundle;
                this.encryptMessage = sessionCipher.encryptMessage;
                this.decryptWhisperMessage = sessionCipher.decryptWhisperMessage;
                this.decryptPreKeyWhisperMessage = co.wrap($traceurRuntime.initGeneratorFunction(function $__23(session, preKeyWhisperMessageBytes) {
                    var $__7, newSession, identityKey, registrationId, $__8, finalSession, message, $__24, $__25, $__26, $__27, $__28, $__29, $__30, $__31, $__32, $__33, $__34;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $__24 = sessionFactory.createSessionFromPreKeyWhisperMessage;
                                $__25 = $__24.call(sessionFactory, session, preKeyWhisperMessageBytes);
                                $ctx.state = 6;
                                break;
                            case 6:
                                $ctx.state = 2;
                                return $__25;
                            case 2:
                                $__26 = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $__7 = $__26;
                                $__27 = $__7.session;
                                newSession = $__27;
                                $__28 = $__7.identityKey;
                                identityKey = $__28;
                                $__29 = $__7.registrationId;
                                registrationId = $__29;
                                $ctx.state = 8;
                                break;
                            case 8:
                                $__30 = sessionCipher.decryptPreKeyWhisperMessage;
                                $__31 = $__30.call(sessionCipher, newSession, preKeyWhisperMessageBytes);
                                $ctx.state = 14;
                                break;
                            case 14:
                                $ctx.state = 10;
                                return $__31;
                            case 10:
                                $__32 = $ctx.sent;
                                $ctx.state = 12;
                                break;
                            case 12:
                                $__8 = $__32;
                                $__33 = $__8.session;
                                finalSession = $__33;
                                $__34 = $__8.message;
                                message = $__34;
                                $ctx.state = 16;
                                break;
                            case 16:
                                $ctx.returnValue = {
                                    message: message,
                                    session: finalSession,
                                    identityKey: identityKey,
                                    registrationId: registrationId
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__23, this);
                }));
                Object.freeze(self);
            }
            var $__default = Axolotl;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var Chain = function Chain(key) {
                this.key = key;
                this.index = 0;
                this.messageKeys = [];
                Object.seal(this);
            };
            $traceurRuntime.createClass(Chain, {}, {});
            var $__default = Chain;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__PromiseInterfaceDecorator__;
            var PromiseInterfaceDecorator = ($__PromiseInterfaceDecorator__ = _require(8), $__PromiseInterfaceDecorator__ && $__PromiseInterfaceDecorator__.__esModule && $__PromiseInterfaceDecorator__ || { default: $__PromiseInterfaceDecorator__ }).default;
            var methodNames = [
                    'generateKeyPair',
                    'calculateAgreement',
                    'randomBytes',
                    'sign',
                    'verifySignature',
                    'hmac',
                    'encrypt',
                    'decrypt'
                ];
            var Crypto = function Crypto(crypto) {
                $traceurRuntime.superConstructor($Crypto).call(this, crypto, methodNames);
            };
            var $Crypto = Crypto;
            $traceurRuntime.createClass(Crypto, {}, {}, PromiseInterfaceDecorator);
            var $__default = Crypto;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                InvalidMessageException: {
                    get: function () {
                        return InvalidMessageException;
                    }
                },
                DuplicateMessageException: {
                    get: function () {
                        return DuplicateMessageException;
                    }
                },
                InvalidKeyException: {
                    get: function () {
                        return InvalidKeyException;
                    }
                },
                UnsupportedProtocolVersionException: {
                    get: function () {
                        return UnsupportedProtocolVersionException;
                    }
                },
                UntrustedIdentityException: {
                    get: function () {
                        return UntrustedIdentityException;
                    }
                },
                __esModule: { value: true }
            });
            var InvalidMessageException = function InvalidMessageException() {
                $traceurRuntime.superConstructor($InvalidMessageException).apply(this, arguments);
            };
            var $InvalidMessageException = InvalidMessageException;
            $traceurRuntime.createClass(InvalidMessageException, {}, {}, Error);
            var DuplicateMessageException = function DuplicateMessageException() {
                $traceurRuntime.superConstructor($DuplicateMessageException).apply(this, arguments);
            };
            var $DuplicateMessageException = DuplicateMessageException;
            $traceurRuntime.createClass(DuplicateMessageException, {}, {}, Error);
            var InvalidKeyException = function InvalidKeyException() {
                $traceurRuntime.superConstructor($InvalidKeyException).apply(this, arguments);
            };
            var $InvalidKeyException = InvalidKeyException;
            $traceurRuntime.createClass(InvalidKeyException, {}, {}, Error);
            var UnsupportedProtocolVersionException = function UnsupportedProtocolVersionException() {
                $traceurRuntime.superConstructor($UnsupportedProtocolVersionException).apply(this, arguments);
            };
            var $UnsupportedProtocolVersionException = UnsupportedProtocolVersionException;
            $traceurRuntime.createClass(UnsupportedProtocolVersionException, {}, {}, Error);
            var UntrustedIdentityException = function UntrustedIdentityException() {
                $traceurRuntime.superConstructor($UntrustedIdentityException).apply(this, arguments);
            };
            var $UntrustedIdentityException = UntrustedIdentityException;
            $traceurRuntime.createClass(UntrustedIdentityException, {}, {}, Error);
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__ArrayBufferUtils__, $__co__;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var co = ($__co__ = _require(18), $__co__ && $__co__.__esModule && $__co__ || { default: $__co__ }).default;
            var hashOutputSize = 32;
            var iterationStartOffset = 1;
            function HKDF(crypto) {
                var self = this;
                var extract = function (salt, inputKeyMaterial) {
                    return crypto.hmac(salt, inputKeyMaterial);
                };
                var expand = co.wrap($traceurRuntime.initGeneratorFunction(function $__2(prk, info, outputByteCount) {
                        var iterations, mixin, result, remainingBytes, i, inputBytes, stepResultArray, stepResult, stepSize, stepSlice;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    iterations = Math.ceil(outputByteCount / hashOutputSize);
                                    mixin = new ArrayBuffer(0);
                                    result = new Uint8Array(outputByteCount);
                                    remainingBytes = outputByteCount;
                                    $ctx.state = 15;
                                    break;
                                case 15:
                                    i = iterationStartOffset;
                                    $ctx.state = 11;
                                    break;
                                case 11:
                                    $ctx.state = i < iterations + iterationStartOffset ? 5 : 9;
                                    break;
                                case 8:
                                    i++;
                                    $ctx.state = 11;
                                    break;
                                case 5:
                                    inputBytes = ArrayBufferUtils.concat(mixin, info, new Uint8Array([i]).buffer);
                                    $ctx.state = 6;
                                    break;
                                case 6:
                                    $ctx.state = 2;
                                    return crypto.hmac(prk, inputBytes);
                                case 2:
                                    stepResultArray = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    stepResult = new Uint8Array(stepResultArray);
                                    stepSize = Math.min(remainingBytes, stepResult.length);
                                    stepSlice = stepResult.subarray(0, stepSize);
                                    result.set(stepSlice, outputByteCount - remainingBytes);
                                    mixin = stepResultArray;
                                    remainingBytes -= stepSize;
                                    $ctx.state = 8;
                                    break;
                                case 9:
                                    $ctx.returnValue = result.buffer;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__2, this);
                    }));
                self.deriveSecretsWithSalt = co.wrap($traceurRuntime.initGeneratorFunction(function $__3(inputKeyMaterial, salt, info, outputByteCount) {
                    var prk, $__4, $__5;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $ctx.state = 2;
                                return extract(salt, inputKeyMaterial);
                            case 2:
                                prk = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $__4 = expand(prk, info, outputByteCount);
                                $ctx.state = 10;
                                break;
                            case 10:
                                $ctx.state = 6;
                                return $__4;
                            case 6:
                                $__5 = $ctx.sent;
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.returnValue = $__5;
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__3, this);
                }));
                self.deriveSecrets = function (inputKeyMaterial, info, outputByteCount) {
                    return self.deriveSecretsWithSalt(inputKeyMaterial, new ArrayBuffer(hashOutputSize), info, outputByteCount);
                };
                Object.freeze(self);
            }
            var $__default = HKDF;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__WhisperProtos__, $__ProtocolConstants__, $__ArrayBufferUtils__;
            var WhisperProtos = ($__WhisperProtos__ = _require(16), $__WhisperProtos__ && $__WhisperProtos__.__esModule && $__WhisperProtos__ || { default: $__WhisperProtos__ }).default;
            var ProtocolConstants = ($__ProtocolConstants__ = _require(9), $__ProtocolConstants__ && $__ProtocolConstants__.__esModule && $__ProtocolConstants__ || { default: $__ProtocolConstants__ }).default;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var getVersionField = function (version) {
                return ArrayBufferUtils.fromByte((version.current << 4 | version.max) & 255);
            };
            var extractMessageVersion = function (versionByte) {
                var view = new Uint8Array(versionByte);
                return {
                    current: view[0] >> 4 & 15,
                    max: view[0] & 15
                };
            };
            var toArrayBuffer = function (obj, key) {
                if (obj[key]) {
                    obj[key] = obj[key].toArrayBuffer();
                }
            };
            var encodeWhisperMessageMacInput = function (whisperMessage) {
                var versionByte = getVersionField(whisperMessage.version);
                var messageBytes = new WhisperProtos.WhisperMessage(whisperMessage.message).encode().toArrayBuffer();
                return ArrayBufferUtils.concat(versionByte, messageBytes);
            };
            var $__default = {
                    decodeWhisperMessage: function (whisperMessageBytes) {
                        var messageBytes = whisperMessageBytes.slice(1, -ProtocolConstants.macByteCount);
                        var message = WhisperProtos.WhisperMessage.decode(messageBytes);
                        toArrayBuffer(message, 'ratchetKey');
                        toArrayBuffer(message, 'ciphertext');
                        return {
                            version: extractMessageVersion(whisperMessageBytes.slice(0, 1)),
                            message: message,
                            mac: whisperMessageBytes.slice(-ProtocolConstants.macByteCount)
                        };
                    },
                    decodeWhisperMessageMacInput: function (whisperMessageBytes) {
                        return whisperMessageBytes.slice(0, -ProtocolConstants.macByteCount);
                    },
                    encodeWhisperMessage: function (whisperMessage) {
                        return ArrayBufferUtils.concat(encodeWhisperMessageMacInput(whisperMessage), whisperMessage.mac);
                    },
                    encodeWhisperMessageMacInput: encodeWhisperMessageMacInput,
                    decodePreKeyWhisperMessage: function (preKeyWhisperMessageBytes) {
                        var message = WhisperProtos.PreKeyWhisperMessage.decode(preKeyWhisperMessageBytes.slice(1));
                        toArrayBuffer(message, 'message');
                        toArrayBuffer(message, 'baseKey');
                        toArrayBuffer(message, 'identityKey');
                        return {
                            version: extractMessageVersion(preKeyWhisperMessageBytes.slice(0, 1)),
                            message: message
                        };
                    },
                    encodePreKeyWhisperMessage: function (preKeyWhisperMessage) {
                        var message = preKeyWhisperMessage.message;
                        var messageBytes = new WhisperProtos.PreKeyWhisperMessage(message).encode().toArrayBuffer();
                        var versionField = getVersionField(preKeyWhisperMessage.version);
                        return ArrayBufferUtils.concat(versionField, messageBytes);
                    }
                };
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var wrap = function (fn) {
                return function () {
                    return Promise.resolve(fn.apply(this, arguments));
                };
            };
            var PromiseInterfaceDecorator = function PromiseInterfaceDecorator(impl, methodNames) {
                var $__0 = this;
                methodNames.forEach(function (methodName) {
                    if (!impl[methodName]) {
                        throw new Error('interface must implement ' + methodName);
                    }
                    $__0[methodName] = wrap(impl[methodName]);
                });
                Object.freeze(this);
            };
            $traceurRuntime.createClass(PromiseInterfaceDecorator, {}, {});
            var $__default = PromiseInterfaceDecorator;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__default = {
                    currentVersion: 3,
                    macByteCount: 8,
                    cipherKeyByteCount: 32,
                    macKeyByteCount: 32,
                    ivByteCount: 16,
                    dhKeyByteCount: 32,
                    rootKeyByteCount: 32,
                    chainKeyByteCount: 32,
                    maximumRetainedReceivedChainKeys: 5,
                    maximumMissedMessages: 2000,
                    maximumSessionStatesPerIdentity: 40
                };
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__HKDF__, $__Chain__, $__ArrayBufferUtils__, $__ProtocolConstants__, $__co__;
            var HKDF = ($__HKDF__ = _require(6), $__HKDF__ && $__HKDF__.__esModule && $__HKDF__ || { default: $__HKDF__ }).default;
            var Chain = ($__Chain__ = _require(3), $__Chain__ && $__Chain__.__esModule && $__Chain__ || { default: $__Chain__ }).default;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var ProtocolConstants = ($__ProtocolConstants__ = _require(9), $__ProtocolConstants__ && $__ProtocolConstants__.__esModule && $__ProtocolConstants__ || { default: $__ProtocolConstants__ }).default;
            var co = ($__co__ = _require(18), $__co__ && $__co__.__esModule && $__co__ || { default: $__co__ }).default;
            var messageKeySeed = 1;
            var chainKeySeed = 2;
            var whisperMessageKeys = new Uint8Array([
                    87,
                    104,
                    105,
                    115,
                    112,
                    101,
                    114,
                    77,
                    101,
                    115,
                    115,
                    97,
                    103,
                    101,
                    75,
                    101,
                    121,
                    115
                ]).buffer;
            var whisperRatchet = new Uint8Array([
                    87,
                    104,
                    105,
                    115,
                    112,
                    101,
                    114,
                    82,
                    97,
                    116,
                    99,
                    104,
                    101,
                    116
                ]).buffer;
            var whisperText = new Uint8Array([
                    87,
                    104,
                    105,
                    115,
                    112,
                    101,
                    114,
                    84,
                    101,
                    120,
                    116
                ]).buffer;
            var discontinuityBytes = new Uint8Array([
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255,
                    255
                ]).buffer;
            function Ratchet(crypto) {
                var self = this;
                var hkdf = new HKDF(crypto);
                this.deriveInitialRootKeyAndChain = co.wrap($traceurRuntime.initGeneratorFunction(function $__5(sessionVersion, agreements) {
                    var secrets, masterSecret, derivedSecret;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                secrets = [];
                                if (sessionVersion >= 3) {
                                    secrets.push(discontinuityBytes);
                                }
                                secrets = secrets.concat(agreements);
                                masterSecret = ArrayBufferUtils.concat(secrets);
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.state = 2;
                                return hkdf.deriveSecrets(masterSecret, whisperText, ProtocolConstants.rootKeyByteCount + ProtocolConstants.chainKeyByteCount);
                            case 2:
                                derivedSecret = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $ctx.returnValue = {
                                    rootKey: derivedSecret.slice(0, ProtocolConstants.rootKeyByteCount),
                                    chain: new Chain(derivedSecret.slice(ProtocolConstants.rootKeyByteCount))
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__5, this);
                }));
                this.deriveNextRootKeyAndChain = co.wrap($traceurRuntime.initGeneratorFunction(function $__6(rootKey, theirEphemeralPublicKey, ourEphemeralPrivateKey) {
                    var sharedSecret, derivedSecretBytes;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $ctx.state = 2;
                                return crypto.calculateAgreement(theirEphemeralPublicKey, ourEphemeralPrivateKey);
                            case 2:
                                sharedSecret = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $ctx.state = 6;
                                return hkdf.deriveSecretsWithSalt(sharedSecret, rootKey, whisperRatchet, ProtocolConstants.rootKeyByteCount + ProtocolConstants.chainKeyByteCount);
                            case 6:
                                derivedSecretBytes = $ctx.sent;
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.returnValue = {
                                    rootKey: derivedSecretBytes.slice(0, ProtocolConstants.rootKeyByteCount),
                                    chain: new Chain(derivedSecretBytes.slice(ProtocolConstants.rootKeyByteCount))
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__6, this);
                }));
                this.clickSubRatchet = co.wrap($traceurRuntime.initGeneratorFunction(function $__7(chain) {
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                chain.index++;
                                $ctx.state = 6;
                                break;
                            case 6:
                                $ctx.state = 2;
                                return deriveNextChainKey(chain.key);
                            case 2:
                                chain.key = $ctx.sent;
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__7, this);
                }));
                this.deriveMessageKeys = co.wrap($traceurRuntime.initGeneratorFunction(function $__8(chainKey) {
                    var messageKey, keyMaterialBytes, cipherKeyBytes, macKeyBytes, ivBytes;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $ctx.state = 2;
                                return deriveMessageKey(chainKey);
                            case 2:
                                messageKey = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $ctx.state = 6;
                                return hkdf.deriveSecrets(messageKey, whisperMessageKeys, ProtocolConstants.cipherKeyByteCount + ProtocolConstants.macKeyByteCount + ProtocolConstants.ivByteCount);
                            case 6:
                                keyMaterialBytes = $ctx.sent;
                                $ctx.state = 8;
                                break;
                            case 8:
                                cipherKeyBytes = keyMaterialBytes.slice(0, ProtocolConstants.cipherKeyByteCount);
                                macKeyBytes = keyMaterialBytes.slice(ProtocolConstants.cipherKeyByteCount, ProtocolConstants.cipherKeyByteCount + ProtocolConstants.macKeyByteCount);
                                ivBytes = keyMaterialBytes.slice(ProtocolConstants.cipherKeyByteCount + ProtocolConstants.macKeyByteCount);
                                $ctx.state = 12;
                                break;
                            case 12:
                                $ctx.returnValue = {
                                    cipherKey: cipherKeyBytes,
                                    macKey: macKeyBytes,
                                    iv: ivBytes
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__8, this);
                }));
                var hmacByte = co.wrap($traceurRuntime.initGeneratorFunction(function $__9(key, byte) {
                        var $__10, $__11, $__12, $__13, $__14;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $__10 = crypto.hmac;
                                    $__11 = ArrayBufferUtils.fromByte;
                                    $__12 = $__11.call(ArrayBufferUtils, byte);
                                    $__13 = $__10.call(crypto, key, $__12);
                                    $ctx.state = 6;
                                    break;
                                case 6:
                                    $ctx.state = 2;
                                    return $__13;
                                case 2:
                                    $__14 = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.returnValue = $__14;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__9, this);
                    }));
                var deriveMessageKey = co.wrap($traceurRuntime.initGeneratorFunction(function $__15(chainKey) {
                        var $__16, $__17;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $__16 = hmacByte(chainKey, messageKeySeed);
                                    $ctx.state = 6;
                                    break;
                                case 6:
                                    $ctx.state = 2;
                                    return $__16;
                                case 2:
                                    $__17 = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.returnValue = $__17;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__15, this);
                    }));
                var deriveNextChainKey = co.wrap($traceurRuntime.initGeneratorFunction(function $__18(chainKey) {
                        var $__19, $__20;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $__19 = hmacByte(chainKey, chainKeySeed);
                                    $ctx.state = 6;
                                    break;
                                case 6:
                                    $ctx.state = 2;
                                    return $__19;
                                case 2:
                                    $__20 = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.returnValue = $__20;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__18, this);
                    }));
            }
            var $__default = Ratchet;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__ProtocolConstants__, $__ArrayBufferUtils__, $__SessionState__;
            var ProtocolConstants = ($__ProtocolConstants__ = _require(9), $__ProtocolConstants__ && $__ProtocolConstants__.__esModule && $__ProtocolConstants__ || { default: $__ProtocolConstants__ }).default;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var SessionState = ($__SessionState__ = _require(14), $__SessionState__ && $__SessionState__.__esModule && $__SessionState__ || { default: $__SessionState__ }).default;
            var Session = function Session(session) {
                this.states = [];
                if (session) {
                    for (var $__4 = session.states[$traceurRuntime.toProperty(Symbol.iterator)](), $__5 = void 0; !($__5 = $__4.next()).done;) {
                        var state = $__5.value;
                        {
                            this.states.push(new SessionState(state));
                        }
                    }
                }
                Object.seal(this);
            };
            $traceurRuntime.createClass(Session, {
                mostRecentState: function () {
                    return this.states[0];
                },
                addState: function (state) {
                    this.states.unshift(state);
                    if (this.states.length > ProtocolConstants.maximumSessionStatesPerIdentity) {
                        this.states.pop();
                    }
                },
                removeState: function (state) {
                    var index = this.states.indexOf(state);
                    this.states.splice(index, 1);
                }
            }, {});
            var $__default = Session;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__ArrayBufferUtils__, $__ProtocolConstants__, $__Messages__, $__SessionState__, $__Session__, $__Ratchet__, $__Exceptions__, $__co__;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var ProtocolConstants = ($__ProtocolConstants__ = _require(9), $__ProtocolConstants__ && $__ProtocolConstants__.__esModule && $__ProtocolConstants__ || { default: $__ProtocolConstants__ }).default;
            var Messages = ($__Messages__ = _require(7), $__Messages__ && $__Messages__.__esModule && $__Messages__ || { default: $__Messages__ }).default;
            var SessionState = ($__SessionState__ = _require(14), $__SessionState__ && $__SessionState__.__esModule && $__SessionState__ || { default: $__SessionState__ }).default;
            var Session = ($__Session__ = _require(11), $__Session__ && $__Session__.__esModule && $__Session__ || { default: $__Session__ }).default;
            var Ratchet = ($__Ratchet__ = _require(10), $__Ratchet__ && $__Ratchet__.__esModule && $__Ratchet__ || { default: $__Ratchet__ }).default;
            var $__6 = ($__Exceptions__ = _require(5), $__Exceptions__ && $__Exceptions__.__esModule && $__Exceptions__ || { default: $__Exceptions__ }), InvalidMessageException = $__6.InvalidMessageException, DuplicateMessageException = $__6.DuplicateMessageException;
            var co = ($__co__ = _require(18), $__co__ && $__co__.__esModule && $__co__ || { default: $__co__ }).default;
            function SessionCipher(crypto) {
                var self = this;
                var ratchet = new Ratchet(crypto);
                this.encryptMessage = co.wrap($traceurRuntime.initGeneratorFunction(function $__12(session, message) {
                    var newSession, whisperMessage;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                newSession = new Session(session);
                                $ctx.state = 15;
                                break;
                            case 15:
                                $ctx.state = 2;
                                return createWhisperMessage(newSession, message);
                            case 2:
                                whisperMessage = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $ctx.state = 6;
                                return ratchet.clickSubRatchet(newSession.mostRecentState().sendingChain);
                            case 6:
                                $ctx.maybeThrow();
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.state = newSession.mostRecentState().pendingPreKey ? 9 : 11;
                                break;
                            case 9:
                                $ctx.returnValue = {
                                    isPreKeyWhisperMessage: true,
                                    body: createPreKeyWhisperMessage(newSession, whisperMessage),
                                    session: newSession
                                };
                                $ctx.state = -2;
                                break;
                            case 11:
                                $ctx.returnValue = {
                                    isPreKeyWhisperMessage: false,
                                    body: whisperMessage,
                                    session: newSession
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__12, this);
                }));
                this.decryptPreKeyWhisperMessage = function (session, preKeyWhisperMessageBytes) {
                    var preKeyWhisperMessage = Messages.decodePreKeyWhisperMessage(preKeyWhisperMessageBytes);
                    return self.decryptWhisperMessage(session, preKeyWhisperMessage.message.message);
                };
                this.decryptWhisperMessage = co.wrap($traceurRuntime.initGeneratorFunction(function $__13(session, whisperMessageBytes) {
                    var newSession, exceptions, $__8, $__9, state, clonedSessionState, promise, result, messages;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                newSession = new Session(session);
                                exceptions = [];
                                $ctx.state = 17;
                                break;
                            case 17:
                                $__8 = newSession.states[$traceurRuntime.toProperty(Symbol.iterator)](), $__9 = void 0;
                                $ctx.state = 6;
                                break;
                            case 6:
                                $ctx.state = !($__9 = $__8.next()).done ? 12 : 14;
                                break;
                            case 12:
                                state = $__9.value;
                                $ctx.state = 13;
                                break;
                            case 13:
                                clonedSessionState = new SessionState(state);
                                promise = decryptWhisperMessageWithSessionState(clonedSessionState, whisperMessageBytes);
                                $ctx.state = 11;
                                break;
                            case 11:
                                $ctx.state = 2;
                                return promise.catch(function (e) {
                                    exceptions.push(e);
                                });
                            case 2:
                                result = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                $ctx.state = result !== undefined ? 7 : 6;
                                break;
                            case 7:
                                newSession.removeState(state);
                                newSession.addState(clonedSessionState);
                                $ctx.state = 8;
                                break;
                            case 8:
                                $ctx.returnValue = {
                                    message: result,
                                    session: newSession
                                };
                                $ctx.state = -2;
                                break;
                            case 14:
                                messages = exceptions.map(function (e) {
                                    return e.toString();
                                });
                                throw new InvalidMessageException('Unable to decrypt message: ' + messages);
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__13, this);
                }));
                var decryptWhisperMessageWithSessionState = co.wrap($traceurRuntime.initGeneratorFunction(function $__14(sessionState, whisperMessageBytes) {
                        var whisperMessage, macInputTypes, message, theirEphemeralPublicKey, receivingChain, messageKeys, isValid, plaintext;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    whisperMessage = Messages.decodeWhisperMessage(whisperMessageBytes);
                                    macInputTypes = Messages.decodeWhisperMessageMacInput(whisperMessageBytes);
                                    if (whisperMessage.version.current !== sessionState.sessionVersion) {
                                        throw new InvalidMessageException('Message version doesn\'t match session version');
                                    }
                                    message = whisperMessage.message;
                                    theirEphemeralPublicKey = message.ratchetKey;
                                    $ctx.state = 20;
                                    break;
                                case 20:
                                    $ctx.state = 2;
                                    return getOrCreateReceivingChain(sessionState, theirEphemeralPublicKey);
                                case 2:
                                    receivingChain = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.state = 6;
                                    return getOrCreateMessageKeys(theirEphemeralPublicKey, receivingChain, message.counter);
                                case 6:
                                    messageKeys = $ctx.sent;
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    $ctx.state = 10;
                                    return isValidMac(macInputTypes, messageKeys.macKey, whisperMessage.version.current, sessionState.remoteIdentityKey, sessionState.localIdentityKey, whisperMessage.mac);
                                case 10:
                                    isValid = $ctx.sent;
                                    $ctx.state = 12;
                                    break;
                                case 12:
                                    if (!isValid) {
                                        throw new InvalidMessageException('Bad mac');
                                    }
                                    $ctx.state = 22;
                                    break;
                                case 22:
                                    $ctx.state = 14;
                                    return crypto.decrypt(messageKeys.cipherKey, message.ciphertext, messageKeys.iv);
                                case 14:
                                    plaintext = $ctx.sent;
                                    $ctx.state = 16;
                                    break;
                                case 16:
                                    sessionState.pendingPreKey = null;
                                    $ctx.state = 24;
                                    break;
                                case 24:
                                    $ctx.returnValue = plaintext;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__14, this);
                    }));
                var isValidMac = co.wrap($traceurRuntime.initGeneratorFunction(function $__15(data, macKey, messageVersion, senderIdentityKey, receiverIdentityKey, theirMac) {
                        var ourMac;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $ctx.state = 2;
                                    return getMac(data, macKey, messageVersion, senderIdentityKey, receiverIdentityKey);
                                case 2:
                                    ourMac = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.returnValue = ArrayBufferUtils.areEqual(ourMac, theirMac);
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__15, this);
                    }));
                var getMac = co.wrap($traceurRuntime.initGeneratorFunction(function $__16(data, macKey, messageVersion, senderIdentityKey, receiverIdentityKey) {
                        var macInputs, macBytes;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    macInputs = messageVersion >= 3 ? [
                                        senderIdentityKey,
                                        receiverIdentityKey
                                    ] : [];
                                    macInputs.push(data);
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    $ctx.state = 2;
                                    return crypto.hmac(macKey, ArrayBufferUtils.concat(macInputs));
                                case 2:
                                    macBytes = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.returnValue = macBytes.slice(0, ProtocolConstants.macByteCount);
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__16, this);
                    }));
                var createWhisperMessage = co.wrap($traceurRuntime.initGeneratorFunction(function $__17(session, paddedMessage) {
                        var messageKeys, ciphertext, version, message, macInputBytes, $__18, $__19, $__20, $__21, $__22, $__23, $__24, $__25, $__26, $__27, $__28, $__29, $__30, $__31, $__32;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $ctx.state = 2;
                                    return ratchet.deriveMessageKeys(session.mostRecentState().sendingChain.key);
                                case 2:
                                    messageKeys = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.state = 6;
                                    return crypto.encrypt(messageKeys.cipherKey, paddedMessage, messageKeys.iv);
                                case 6:
                                    ciphertext = $ctx.sent;
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    version = {
                                        current: session.mostRecentState().sessionVersion,
                                        max: ProtocolConstants.currentVersion
                                    };
                                    message = {
                                        ratchetKey: session.mostRecentState().senderRatchetKeyPair.public,
                                        counter: session.mostRecentState().sendingChain.index,
                                        previousCounter: session.mostRecentState().previousCounter,
                                        ciphertext: ciphertext
                                    };
                                    macInputBytes = Messages.encodeWhisperMessageMacInput({
                                        version: version,
                                        message: message
                                    });
                                    $ctx.state = 20;
                                    break;
                                case 20:
                                    $__18 = Messages.encodeWhisperMessage;
                                    $__19 = messageKeys.macKey;
                                    $__20 = session.mostRecentState;
                                    $__21 = $__20.call(session);
                                    $__22 = $__21.sessionVersion;
                                    $__23 = session.mostRecentState;
                                    $__24 = $__23.call(session);
                                    $__25 = $__24.localIdentityKey;
                                    $__26 = session.mostRecentState;
                                    $__27 = $__26.call(session);
                                    $__28 = $__27.remoteIdentityKey;
                                    $__29 = getMac(macInputBytes, $__19, $__22, $__25, $__28);
                                    $ctx.state = 14;
                                    break;
                                case 14:
                                    $ctx.state = 10;
                                    return $__29;
                                case 10:
                                    $__30 = $ctx.sent;
                                    $ctx.state = 12;
                                    break;
                                case 12:
                                    $__31 = {
                                        version: version,
                                        message: message,
                                        mac: $__30
                                    };
                                    $__32 = $__18.call(Messages, $__31);
                                    $ctx.state = 16;
                                    break;
                                case 16:
                                    $ctx.returnValue = $__32;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__17, this);
                    }));
                var createPreKeyWhisperMessage = function (session, whisperMessage) {
                    var pendingPreKey = session.mostRecentState().pendingPreKey;
                    return Messages.encodePreKeyWhisperMessage({
                        version: {
                            current: session.mostRecentState().sessionVersion,
                            max: ProtocolConstants.currentVersion
                        },
                        message: {
                            registrationId: session.mostRecentState().localRegistrationId,
                            preKeyId: pendingPreKey.preKeyId,
                            signedPreKeyId: pendingPreKey.signedPreKeyId,
                            baseKey: pendingPreKey.baseKey,
                            identityKey: session.mostRecentState().localIdentityKey,
                            message: whisperMessage
                        }
                    });
                };
                var getOrCreateReceivingChain = co.wrap($traceurRuntime.initGeneratorFunction(function $__33(sessionState, theirEphemeralPublicKey) {
                        var chain, $__34, $__35;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    chain = sessionState.findReceivingChain(theirEphemeralPublicKey);
                                    $ctx.state = 13;
                                    break;
                                case 13:
                                    $ctx.state = chain ? 1 : 2;
                                    break;
                                case 1:
                                    $ctx.returnValue = chain;
                                    $ctx.state = -2;
                                    break;
                                case 2:
                                    $__34 = clickMainRatchet(sessionState, theirEphemeralPublicKey);
                                    $ctx.state = 9;
                                    break;
                                case 9:
                                    $ctx.state = 5;
                                    return $__34;
                                case 5:
                                    $__35 = $ctx.sent;
                                    $ctx.state = 7;
                                    break;
                                case 7:
                                    $ctx.returnValue = $__35;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__33, this);
                    }));
                var getOrCreateMessageKeys = co.wrap($traceurRuntime.initGeneratorFunction(function $__36(theirEphemeralPublicKey, chain, counter) {
                        var cachedMessageKeys, messageKeys;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $ctx.state = chain.index > counter ? 3 : 24;
                                    break;
                                case 3:
                                    cachedMessageKeys = chain.messageKeys[counter];
                                    if (!cachedMessageKeys) {
                                        throw new DuplicateMessageException('Received message with old counter');
                                    }
                                    delete chain.messageKeys[counter];
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $ctx.returnValue = cachedMessageKeys;
                                    $ctx.state = -2;
                                    break;
                                case 24:
                                    if (counter - chain.index > ProtocolConstants.maximumMissedMessages) {
                                        throw new InvalidMessageException('Too many skipped messages');
                                    }
                                    $ctx.state = 25;
                                    break;
                                case 25:
                                    $ctx.state = chain.index < counter ? 5 : 13;
                                    break;
                                case 5:
                                    $ctx.state = 6;
                                    return ratchet.deriveMessageKeys(chain.key);
                                case 6:
                                    chain.messageKeys[chain.index] = $ctx.sent;
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    $ctx.state = 10;
                                    return ratchet.clickSubRatchet(chain);
                                case 10:
                                    $ctx.maybeThrow();
                                    $ctx.state = 25;
                                    break;
                                case 13:
                                    $ctx.state = 15;
                                    return ratchet.deriveMessageKeys(chain.key);
                                case 15:
                                    messageKeys = $ctx.sent;
                                    $ctx.state = 17;
                                    break;
                                case 17:
                                    $ctx.state = 19;
                                    return ratchet.clickSubRatchet(chain);
                                case 19:
                                    $ctx.maybeThrow();
                                    $ctx.state = 21;
                                    break;
                                case 21:
                                    $ctx.returnValue = messageKeys;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__36, this);
                    }));
                var clickMainRatchet = co.wrap($traceurRuntime.initGeneratorFunction(function $__37(sessionState, theirEphemeralPublicKey) {
                        var $__10, theirRootKey, nextReceivingChain, ourNewEphemeralKeyPair, $__11, rootKey, nextSendingChain, $__38, $__39, $__40, $__41, $__42, $__43, $__44, $__45, $__46, $__47, $__48, $__49, $__50, $__51;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $__38 = ratchet.deriveNextRootKeyAndChain;
                                    $__39 = sessionState.rootKey;
                                    $__40 = sessionState.senderRatchetKeyPair;
                                    $__41 = $__40.private;
                                    $__42 = $__38.call(ratchet, $__39, theirEphemeralPublicKey, $__41);
                                    $ctx.state = 6;
                                    break;
                                case 6:
                                    $ctx.state = 2;
                                    return $__42;
                                case 2:
                                    $__43 = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $__10 = $__43;
                                    $__44 = $__10.rootKey;
                                    theirRootKey = $__44;
                                    $__45 = $__10.chain;
                                    nextReceivingChain = $__45;
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    $ctx.state = 10;
                                    return crypto.generateKeyPair();
                                case 10:
                                    ourNewEphemeralKeyPair = $ctx.sent;
                                    $ctx.state = 12;
                                    break;
                                case 12:
                                    $__46 = ratchet.deriveNextRootKeyAndChain;
                                    $__47 = ourNewEphemeralKeyPair.private;
                                    $__48 = $__46.call(ratchet, theirRootKey, theirEphemeralPublicKey, $__47);
                                    $ctx.state = 18;
                                    break;
                                case 18:
                                    $ctx.state = 14;
                                    return $__48;
                                case 14:
                                    $__49 = $ctx.sent;
                                    $ctx.state = 16;
                                    break;
                                case 16:
                                    $__11 = $__49;
                                    $__50 = $__11.rootKey;
                                    rootKey = $__50;
                                    $__51 = $__11.chain;
                                    nextSendingChain = $__51;
                                    $ctx.state = 20;
                                    break;
                                case 20:
                                    sessionState.rootKey = rootKey;
                                    sessionState.addReceivingChain(theirEphemeralPublicKey, nextReceivingChain);
                                    sessionState.previousCounter = Math.max(sessionState.sendingChain.index - 1, 0);
                                    sessionState.sendingChain = nextSendingChain;
                                    sessionState.senderRatchetKeyPair = ourNewEphemeralKeyPair;
                                    $ctx.state = 24;
                                    break;
                                case 24:
                                    $ctx.returnValue = nextReceivingChain;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__37, this);
                    }));
                Object.freeze(self);
            }
            var $__default = SessionCipher;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__WhisperProtos__, $__ArrayBufferUtils__, $__Messages__, $__Ratchet__, $__SessionState__, $__Session__, $__Exceptions__, $__co__;
            var WhisperProtos = ($__WhisperProtos__ = _require(16), $__WhisperProtos__ && $__WhisperProtos__.__esModule && $__WhisperProtos__ || { default: $__WhisperProtos__ }).default;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var Messages = ($__Messages__ = _require(7), $__Messages__ && $__Messages__.__esModule && $__Messages__ || { default: $__Messages__ }).default;
            var Ratchet = ($__Ratchet__ = _require(10), $__Ratchet__ && $__Ratchet__.__esModule && $__Ratchet__ || { default: $__Ratchet__ }).default;
            var SessionState = ($__SessionState__ = _require(14), $__SessionState__ && $__SessionState__.__esModule && $__SessionState__ || { default: $__SessionState__ }).default;
            var Session = ($__Session__ = _require(11), $__Session__ && $__Session__.__esModule && $__Session__ || { default: $__Session__ }).default;
            var $__6 = ($__Exceptions__ = _require(5), $__Exceptions__ && $__Exceptions__.__esModule && $__Exceptions__ || { default: $__Exceptions__ }), InvalidKeyException = $__6.InvalidKeyException, UnsupportedProtocolVersionException = $__6.UnsupportedProtocolVersionException, UntrustedIdentityException = $__6.UntrustedIdentityException;
            var co = ($__co__ = _require(18), $__co__ && $__co__.__esModule && $__co__ || { default: $__co__ }).default;
            function SessionFactory(crypto, store) {
                var self = this;
                var ratchet = new Ratchet(crypto);
                self.createSessionFromPreKeyBundle = co.wrap($traceurRuntime.initGeneratorFunction(function $__12(retrievedPreKeyBundle) {
                    var validSignature, supportsV3, ourBaseKeyPair, theirSignedPreKey, aliceParameters, sessionState, session, $__13, $__14, $__15, $__16, $__17, $__18, $__19;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                $ctx.state = retrievedPreKeyBundle.signedPreKey ? 1 : 6;
                                break;
                            case 1:
                                $ctx.state = 2;
                                return crypto.verifySignature(retrievedPreKeyBundle.identityKey, retrievedPreKeyBundle.signedPreKey, retrievedPreKeyBundle.signedPreKeySignature);
                            case 2:
                                validSignature = $ctx.sent;
                                $ctx.state = 4;
                                break;
                            case 4:
                                if (!validSignature) {
                                    throw new InvalidKeyException('Invalid signature on device key');
                                }
                                $ctx.state = 6;
                                break;
                            case 6:
                                if (!retrievedPreKeyBundle.preKey && !retrievedPreKeyBundle.signedPreKey) {
                                    throw new InvalidKeyException('Both signed and unsigned pre keys are absent');
                                }
                                supportsV3 = !!retrievedPreKeyBundle.signedPreKey;
                                $ctx.state = 31;
                                break;
                            case 31:
                                $ctx.state = 9;
                                return crypto.generateKeyPair();
                            case 9:
                                ourBaseKeyPair = $ctx.sent;
                                $ctx.state = 11;
                                break;
                            case 11:
                                theirSignedPreKey = supportsV3 ? retrievedPreKeyBundle.signedPreKey : retrievedPreKeyBundle.preKey;
                                $ctx.state = 33;
                                break;
                            case 33:
                                $__13 = store.getLocalIdentityKeyPair;
                                $__14 = $__13.call(store);
                                $ctx.state = 17;
                                break;
                            case 17:
                                $ctx.state = 13;
                                return $__14;
                            case 13:
                                $__15 = $ctx.sent;
                                $ctx.state = 15;
                                break;
                            case 15:
                                $__16 = retrievedPreKeyBundle.identityKey;
                                if (supportsV3) {
                                    $__17 = retrievedPreKeyBundle.preKey;
                                    $__18 = $__17;
                                } else {
                                    $__18 = undefined;
                                }
                                $__19 = {
                                    sessionVersion: supportsV3 ? 3 : 2,
                                    ourBaseKeyPair: ourBaseKeyPair,
                                    ourIdentityKeyPair: $__15,
                                    theirIdentityKey: $__16,
                                    theirSignedPreKey: theirSignedPreKey,
                                    theirRatchetKey: theirSignedPreKey,
                                    theirOneTimePreKey: $__18
                                };
                                aliceParameters = $__19;
                                $ctx.state = 19;
                                break;
                            case 19:
                                $ctx.state = 21;
                                return initializeAliceSession(aliceParameters);
                            case 21:
                                sessionState = $ctx.sent;
                                $ctx.state = 23;
                                break;
                            case 23:
                                sessionState.pendingPreKey = {
                                    preKeyId: supportsV3 ? retrievedPreKeyBundle.preKeyId : null,
                                    signedPreKeyId: retrievedPreKeyBundle.signedPreKeyId,
                                    baseKey: ourBaseKeyPair.public
                                };
                                $ctx.state = 35;
                                break;
                            case 35:
                                $ctx.state = 25;
                                return store.getLocalRegistrationId();
                            case 25:
                                sessionState.localRegistrationId = $ctx.sent;
                                $ctx.state = 27;
                                break;
                            case 27:
                                session = new Session();
                                session.addState(sessionState);
                                $ctx.state = 37;
                                break;
                            case 37:
                                $ctx.returnValue = session;
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__12, this);
                }));
                self.createSessionFromPreKeyWhisperMessage = co.wrap($traceurRuntime.initGeneratorFunction(function $__20(session, preKeyWhisperMessageBytes) {
                    var preKeyWhisperMessage, message, $__8, $__9, cachedSessionState, ourSignedPreKeyPair, preKeyPair, bobParameters, sessionState, clonedSession, $__21, $__22, $__23, $__24, $__25, $__26, $__27, $__28;
                    return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                        while (true)
                            switch ($ctx.state) {
                            case 0:
                                preKeyWhisperMessage = Messages.decodePreKeyWhisperMessage(preKeyWhisperMessageBytes);
                                if (preKeyWhisperMessage.version.current !== 3) {
                                    throw new UnsupportedProtocolVersionException('Protocol version ' + preKeyWhisperMessage.version.current + ' is not supported');
                                }
                                message = preKeyWhisperMessage.message;
                                $ctx.state = 33;
                                break;
                            case 33:
                                $ctx.state = session ? 7 : 6;
                                break;
                            case 7:
                                $__8 = session.states[$traceurRuntime.toProperty(Symbol.iterator)](), $__9 = void 0;
                                $ctx.state = 2;
                                break;
                            case 2:
                                $ctx.state = !($__9 = $__8.next()).done ? 4 : 6;
                                break;
                            case 4:
                                cachedSessionState = $__9.value;
                                $ctx.state = 5;
                                break;
                            case 5:
                                $ctx.state = cachedSessionState.theirBaseKey && ArrayBufferUtils.areEqual(cachedSessionState.theirBaseKey, message.baseKey) ? 1 : 2;
                                break;
                            case 1:
                                $ctx.returnValue = {
                                    session: session,
                                    identityKey: message.identityKey,
                                    registrationId: message.registrationId
                                };
                                $ctx.state = -2;
                                break;
                            case 6:
                                $ctx.state = 10;
                                return store.getLocalSignedPreKeyPair(message.signedPreKeyId);
                            case 10:
                                ourSignedPreKeyPair = $ctx.sent;
                                $ctx.state = 12;
                                break;
                            case 12:
                                $ctx.state = message.preKeyId !== null ? 13 : 16;
                                break;
                            case 13:
                                $ctx.state = 14;
                                return store.getLocalPreKeyPair(message.preKeyId);
                            case 14:
                                preKeyPair = $ctx.sent;
                                $ctx.state = 16;
                                break;
                            case 16:
                                $__21 = preKeyWhisperMessage.version;
                                $__22 = $__21.current;
                                $__23 = message.baseKey;
                                $__24 = message.identityKey;
                                $__25 = store.getLocalIdentityKeyPair;
                                $__26 = $__25.call(store);
                                $ctx.state = 23;
                                break;
                            case 23:
                                $ctx.state = 19;
                                return $__26;
                            case 19:
                                $__27 = $ctx.sent;
                                $ctx.state = 21;
                                break;
                            case 21:
                                $__28 = {
                                    sessionVersion: $__22,
                                    theirBaseKey: $__23,
                                    theirIdentityKey: $__24,
                                    ourIdentityKeyPair: $__27,
                                    ourSignedPreKeyPair: ourSignedPreKeyPair,
                                    ourRatchetKeyPair: ourSignedPreKeyPair,
                                    ourOneTimePreKeyPair: preKeyPair
                                };
                                bobParameters = $__28;
                                $ctx.state = 25;
                                break;
                            case 25:
                                $ctx.state = 27;
                                return initializeBobSession(bobParameters);
                            case 27:
                                sessionState = $ctx.sent;
                                $ctx.state = 29;
                                break;
                            case 29:
                                sessionState.theirBaseKey = message.baseKey;
                                clonedSession = new Session(session);
                                clonedSession.addState(sessionState);
                                $ctx.state = 35;
                                break;
                            case 35:
                                $ctx.returnValue = {
                                    session: clonedSession,
                                    identityKey: message.identityKey,
                                    registrationId: message.registrationId
                                };
                                $ctx.state = -2;
                                break;
                            default:
                                return $ctx.end();
                            }
                    }, $__20, this);
                }));
                var initializeAliceSession = co.wrap($traceurRuntime.initGeneratorFunction(function $__29(parameters) {
                        var sendingRatchetKeyPair, agreements, $__10, theirRootKey, receivingChain, $__11, rootKey, sendingChain, sessionState, $__30, $__31, $__32, $__33, $__34, $__35, $__36, $__37, $__38, $__39, $__40, $__41, $__42, $__43;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    $ctx.state = 2;
                                    return crypto.generateKeyPair();
                                case 2:
                                    sendingRatchetKeyPair = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    agreements = [
                                        crypto.calculateAgreement(parameters.theirSignedPreKey, parameters.ourIdentityKeyPair.private),
                                        crypto.calculateAgreement(parameters.theirIdentityKey, parameters.ourBaseKeyPair.private),
                                        crypto.calculateAgreement(parameters.theirSignedPreKey, parameters.ourBaseKeyPair.private)
                                    ];
                                    if (parameters.sessionVersion >= 3 && parameters.theirOneTimePreKey) {
                                        agreements.push(crypto.calculateAgreement(parameters.theirOneTimePreKey, parameters.ourBaseKeyPair.private));
                                    }
                                    $ctx.state = 30;
                                    break;
                                case 30:
                                    $__30 = ratchet.deriveInitialRootKeyAndChain;
                                    $__31 = parameters.sessionVersion;
                                    $ctx.state = 14;
                                    break;
                                case 14:
                                    $ctx.state = 6;
                                    return agreements;
                                case 6:
                                    $__32 = $ctx.sent;
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    $__33 = $__30.call(ratchet, $__31, $__32);
                                    $ctx.state = 16;
                                    break;
                                case 16:
                                    $ctx.state = 10;
                                    return $__33;
                                case 10:
                                    $__34 = $ctx.sent;
                                    $ctx.state = 12;
                                    break;
                                case 12:
                                    $__10 = $__34;
                                    $__35 = $__10.rootKey;
                                    theirRootKey = $__35;
                                    $__36 = $__10.chain;
                                    receivingChain = $__36;
                                    $ctx.state = 18;
                                    break;
                                case 18:
                                    $__37 = ratchet.deriveNextRootKeyAndChain;
                                    $__38 = parameters.theirRatchetKey;
                                    $__39 = sendingRatchetKeyPair.private;
                                    $__40 = $__37.call(ratchet, theirRootKey, $__38, $__39);
                                    $ctx.state = 24;
                                    break;
                                case 24:
                                    $ctx.state = 20;
                                    return $__40;
                                case 20:
                                    $__41 = $ctx.sent;
                                    $ctx.state = 22;
                                    break;
                                case 22:
                                    $__11 = $__41;
                                    $__42 = $__11.rootKey;
                                    rootKey = $__42;
                                    $__43 = $__11.chain;
                                    sendingChain = $__43;
                                    $ctx.state = 26;
                                    break;
                                case 26:
                                    sessionState = new SessionState({
                                        sessionVersion: parameters.sessionVersion,
                                        remoteIdentityKey: parameters.theirIdentityKey,
                                        localIdentityKey: parameters.ourIdentityKeyPair.public,
                                        rootKey: rootKey,
                                        sendingChain: sendingChain,
                                        senderRatchetKeyPair: sendingRatchetKeyPair
                                    });
                                    sessionState.addReceivingChain(parameters.theirRatchetKey, receivingChain);
                                    $ctx.state = 32;
                                    break;
                                case 32:
                                    $ctx.returnValue = sessionState;
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__29, this);
                    }));
                var initializeBobSession = co.wrap($traceurRuntime.initGeneratorFunction(function $__44(parameters) {
                        var agreements, $__10, rootKey, sendingChain, $__45, $__46, $__47, $__48, $__49, $__50, $__51;
                        return $traceurRuntime.createGeneratorInstance(function ($ctx) {
                            while (true)
                                switch ($ctx.state) {
                                case 0:
                                    agreements = [
                                        crypto.calculateAgreement(parameters.theirIdentityKey, parameters.ourSignedPreKeyPair.private),
                                        crypto.calculateAgreement(parameters.theirBaseKey, parameters.ourIdentityKeyPair.private),
                                        crypto.calculateAgreement(parameters.theirBaseKey, parameters.ourSignedPreKeyPair.private)
                                    ];
                                    if (parameters.sessionVersion >= 3 && parameters.ourOneTimePreKeyPair) {
                                        agreements.push(crypto.calculateAgreement(parameters.theirBaseKey, parameters.ourOneTimePreKeyPair.private));
                                    }
                                    $ctx.state = 18;
                                    break;
                                case 18:
                                    $__45 = ratchet.deriveInitialRootKeyAndChain;
                                    $__46 = parameters.sessionVersion;
                                    $ctx.state = 10;
                                    break;
                                case 10:
                                    $ctx.state = 2;
                                    return agreements;
                                case 2:
                                    $__47 = $ctx.sent;
                                    $ctx.state = 4;
                                    break;
                                case 4:
                                    $__48 = $__45.call(ratchet, $__46, $__47);
                                    $ctx.state = 12;
                                    break;
                                case 12:
                                    $ctx.state = 6;
                                    return $__48;
                                case 6:
                                    $__49 = $ctx.sent;
                                    $ctx.state = 8;
                                    break;
                                case 8:
                                    $__10 = $__49;
                                    $__50 = $__10.rootKey;
                                    rootKey = $__50;
                                    $__51 = $__10.chain;
                                    sendingChain = $__51;
                                    $ctx.state = 14;
                                    break;
                                case 14:
                                    $ctx.returnValue = new SessionState({
                                        sessionVersion: parameters.sessionVersion,
                                        remoteIdentityKey: parameters.theirIdentityKey,
                                        localIdentityKey: parameters.ourIdentityKeyPair.public,
                                        rootKey: rootKey,
                                        sendingChain: sendingChain,
                                        senderRatchetKeyPair: parameters.ourRatchetKeyPair
                                    });
                                    $ctx.state = -2;
                                    break;
                                default:
                                    return $ctx.end();
                                }
                        }, $__44, this);
                    }));
                Object.freeze(self);
            }
            var $__default = SessionFactory;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__ArrayBufferUtils__, $__ProtocolConstants__;
            var ArrayBufferUtils = ($__ArrayBufferUtils__ = _require(1), $__ArrayBufferUtils__ && $__ArrayBufferUtils__.__esModule && $__ArrayBufferUtils__ || { default: $__ArrayBufferUtils__ }).default;
            var ProtocolConstants = ($__ProtocolConstants__ = _require(9), $__ProtocolConstants__ && $__ProtocolConstants__.__esModule && $__ProtocolConstants__ || { default: $__ProtocolConstants__ }).default;
            var makeReadonly = function (obj, key) {
                Object.defineProperty(obj, key, { writable: false });
            };
            var SessionState = function SessionState(parameters) {
                Object.assign(this, {
                    sessionVersion: 3,
                    remoteIdentityKey: null,
                    localIdentityKey: null,
                    pendingPreKey: null,
                    localRegistrationId: 0,
                    theirBaseKey: null,
                    rootKey: null,
                    sendingChain: null,
                    senderRatchetKeyPair: null,
                    receivingChains: [],
                    previousCounter: 0
                }, parameters);
                makeReadonly(this, 'sessionVersion');
                makeReadonly(this, 'remoteIdentityKey');
                makeReadonly(this, 'localIdentityKey');
                Object.seal(this);
            };
            $traceurRuntime.createClass(SessionState, {
                findReceivingChain: function (theirEphemeralPublicKey) {
                    for (var i = 0; i < this.receivingChains.length; i++) {
                        var receivingChain = this.receivingChains[i];
                        if (ArrayBufferUtils.areEqual(receivingChain.theirEphemeralKey, theirEphemeralPublicKey)) {
                            return receivingChain.chain;
                        }
                    }
                    return null;
                },
                addReceivingChain: function (theirEphemeralPublicKey, chain) {
                    this.receivingChains.push({
                        theirEphemeralKey: theirEphemeralPublicKey,
                        chain: chain
                    });
                    if (this.receivingChains.length > ProtocolConstants.maximumRetainedReceivedChainKeys) {
                        this.receivingChains.shift();
                    }
                }
            }, {});
            var $__default = SessionState;
        },
        function (module, exports) {
            'use strict';
            Object.defineProperties(module.exports, {
                default: {
                    get: function () {
                        return $__default;
                    }
                },
                __esModule: { value: true }
            });
            var $__PromiseInterfaceDecorator__;
            var PromiseInterfaceDecorator = ($__PromiseInterfaceDecorator__ = _require(8), $__PromiseInterfaceDecorator__ && $__PromiseInterfaceDecorator__.__esModule && $__PromiseInterfaceDecorator__ || { default: $__PromiseInterfaceDecorator__ }).default;
            var methodNames = [
                    'getLocalIdentityKeyPair',
                    'getLocalRegistrationId',
                    'getLocalSignedPreKeyPair',
                    'getLocalPreKeyPair'
                ];
            var Store = function Store(store) {
                $traceurRuntime.superConstructor($Store).call(this, store, methodNames);
            };
            var $Store = Store;
            $traceurRuntime.createClass(Store, {}, {}, PromiseInterfaceDecorator);
            var $__default = Store;
        },
        function (module, exports) {
            'use strict';
            module.exports = _require(19).newBuilder({})['import']({
                'package': 'textsecure',
                'messages': [
                    {
                        'name': 'WhisperMessage',
                        'fields': [
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'ratchetKey',
                                'id': 1
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'counter',
                                'id': 2
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'previousCounter',
                                'id': 3
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'ciphertext',
                                'id': 4
                            }
                        ],
                        'enums': [],
                        'messages': [],
                        'options': {},
                        'oneofs': {}
                    },
                    {
                        'name': 'PreKeyWhisperMessage',
                        'fields': [
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'registrationId',
                                'id': 5
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'preKeyId',
                                'id': 1
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'signedPreKeyId',
                                'id': 6
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'baseKey',
                                'id': 2
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'identityKey',
                                'id': 3
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'message',
                                'id': 4
                            }
                        ],
                        'enums': [],
                        'messages': [],
                        'options': {},
                        'oneofs': {}
                    },
                    {
                        'name': 'KeyExchangeMessage',
                        'fields': [
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'id',
                                'id': 1
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'baseKey',
                                'id': 2
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'ratchetKey',
                                'id': 3
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'identityKey',
                                'id': 4
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'baseKeySignature',
                                'id': 5
                            }
                        ],
                        'enums': [],
                        'messages': [],
                        'options': {},
                        'oneofs': {}
                    },
                    {
                        'name': 'SenderKeyMessage',
                        'fields': [
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'id',
                                'id': 1
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'iteration',
                                'id': 2
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'ciphertext',
                                'id': 3
                            }
                        ],
                        'enums': [],
                        'messages': [],
                        'options': {},
                        'oneofs': {}
                    },
                    {
                        'name': 'SenderKeyDistributionMessage',
                        'fields': [
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'id',
                                'id': 1
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'uint32',
                                'name': 'iteration',
                                'id': 2
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'chainKey',
                                'id': 3
                            },
                            {
                                'rule': 'optional',
                                'options': {},
                                'type': 'bytes',
                                'name': 'signingKey',
                                'id': 4
                            }
                        ],
                        'enums': [],
                        'messages': [],
                        'options': {},
                        'oneofs': {}
                    }
                ],
                'enums': [],
                'imports': [],
                'options': {
                    'java_package': 'org.whispersystems.libaxolotl.protocol',
                    'java_outer_classname': 'WhisperProtos'
                },
                'services': []
            }).build('textsecure');
        },
        function (module, exports) {
            module.exports = __external_axolotlCrypto;
        },
        function (module, exports) {
            var slice = Array.prototype.slice;
            module.exports = co['default'] = co.co = co;
            co.wrap = function (fn) {
                return function () {
                    return co.call(this, fn.apply(this, arguments));
                };
            };
            function co(gen) {
                var ctx = this;
                if (typeof gen === 'function')
                    gen = gen.call(this);
                return new Promise(function (resolve, reject) {
                    onFulfilled();
                    function onFulfilled(res) {
                        var ret;
                        try {
                            ret = gen.next(res);
                        } catch (e) {
                            return reject(e);
                        }
                        next(ret);
                    }
                    function onRejected(err) {
                        var ret;
                        try {
                            ret = gen.throw(err);
                        } catch (e) {
                            return reject(e);
                        }
                        next(ret);
                    }
                    function next(ret) {
                        if (ret.done)
                            return resolve(ret.value);
                        var value = toPromise.call(ctx, ret.value);
                        if (value && isPromise(value))
                            return value.then(onFulfilled, onRejected);
                        return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, ' + 'but the following object was passed: "' + String(ret.value) + '"'));
                    }
                });
            }
            function toPromise(obj) {
                if (!obj)
                    return obj;
                if (isPromise(obj))
                    return obj;
                if (isGeneratorFunction(obj) || isGenerator(obj))
                    return co.call(this, obj);
                if ('function' == typeof obj)
                    return thunkToPromise.call(this, obj);
                if (Array.isArray(obj))
                    return arrayToPromise.call(this, obj);
                if (isObject(obj))
                    return objectToPromise.call(this, obj);
                return obj;
            }
            function thunkToPromise(fn) {
                var ctx = this;
                return new Promise(function (resolve, reject) {
                    fn.call(ctx, function (err, res) {
                        if (err)
                            return reject(err);
                        if (arguments.length > 2)
                            res = slice.call(arguments, 1);
                        resolve(res);
                    });
                });
            }
            function arrayToPromise(obj) {
                return Promise.all(obj.map(toPromise, this));
            }
            function objectToPromise(obj) {
                var results = new obj.constructor();
                var keys = Object.keys(obj);
                var promises = [];
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var promise = toPromise.call(this, obj[key]);
                    if (promise && isPromise(promise))
                        defer(promise, key);
                    else
                        results[key] = obj[key];
                }
                return Promise.all(promises).then(function () {
                    return results;
                });
                function defer(promise, key) {
                    results[key] = undefined;
                    promises.push(promise.then(function (res) {
                        results[key] = res;
                    }));
                }
            }
            function isPromise(obj) {
                return 'function' == typeof obj.then;
            }
            function isGenerator(obj) {
                return 'function' == typeof obj.next && 'function' == typeof obj.throw;
            }
            function isGeneratorFunction(obj) {
                var constructor = obj.constructor;
                var proto = constructor.prototype;
                var name = constructor.displayName || constructor.name;
                var nameLooksRight = 'GeneratorFunction' == name;
                var methodsLooksRight = 'function' == typeof proto.next && 'function' == typeof proto.throw;
                return nameLooksRight || methodsLooksRight;
            }
            function isObject(val) {
                return Object == val.constructor;
            }
        },
        function (module, exports) {
            module.exports = __external_1;
        }
    ];
    return _require(0);
}));
