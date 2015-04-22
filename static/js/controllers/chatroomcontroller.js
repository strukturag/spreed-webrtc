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
define(['jquery', 'underscore', 'moment', 'text!partials/fileinfo.html', 'text!partials/contactrequest.html', 'text!partials/geolocation.html', 'text!partials/picturehover.html'], function($, _, moment, templateFileInfo, templateContactRequest, templateGeolocation, templatePictureHover) {

	// ChatroomController
	return ["$scope", "$element", "$window", "safeMessage", "safeDisplayName", "$compile", "$filter", "translation", "mediaStream", function($scope, $element, $window, safeMessage, safeDisplayName, $compile, $filter, translation, mediaStream) {

		$scope.outputElement = $element.find(".output");
		$scope.inputElement = $element.find(".input");
		$scope.bodyElement = $element.find(".chatbody");
		$scope.menuElement = $element.find(".chatmenu");
		var lastSender = null;
		var lastDate = null;
		var lastMessageContainer = null;
		var senderExpired = null;
		var isTyping = false;
		var isTypingExpired = null;
		var peerTypingExpired = null;
		var p2p = false;
		var scrollAfterInput = false;

		// Mark seen on several events.
		$scope.bodyElement.on("mouseover mouseenter touchstart", _.debounce(function(event) {
			$scope.$parent.seen();
			$scope.$apply();
		}, 100));

		var displayName = safeDisplayName;
		var buddyImageSrc = $filter("buddyImageSrc");
		var fileInfo = $compile(templateFileInfo);
		var contactRequest = $compile(templateContactRequest);
		var geoLocation = $compile(templateGeolocation);
		var pictureHover = $compile(templatePictureHover);

		var knowMessage = {
			r: {},
			pending: [],
			register: function(element, mid, status, received) {
				if (mid) {
					if (knowMessage.r.hasOwnProperty(mid)) {
						console.warn("Duplicate chat message registration.", mid, element, status);
						return;
					}
					var e = knowMessage.r[mid] = {
						element: element,
						status: status
					}
					if (e.status) {
						element.addClass(e.status);
					}
					if (received) {
						knowMessage.pending.push(mid);
						$scope.$emit("submitreceived", mid);
					}
				}
			},
			update: function(mid, status) {
				var e = knowMessage.r[mid];
				if (e) {
					if (e.status !== status && status) {
						if (e.status) {
							e.element.removeClass(e.status);
						}
						e.status = status;
						e.element.addClass(e.status);
						if (status === "received" || status === "read") {
							// last one - cleanup
							delete knowMessage.r[mid];
						}
					}
				}
			},
			seen: function() {
				var pending = knowMessage.pending;
				if (pending.length) {
					knowMessage.pending = [];
					$scope.$emit("submitseen", pending);
					_.each(pending, function(mid) {
						knowMessage.update(mid, "read");
					});
				}
			}
		};

		var addPictureHover = function(from, msg, is_self) {
			if (msg.picture && !is_self) {
				var subscope = $scope.$new();
				subscope.startChat = function() {
					$scope.$emit("startchat", from, {
						autofocus: true,
						restore: true
					});
				};
				subscope.doCall = function() {
					mediaStream.webrtc.doCall(from);
				};
				pictureHover(subscope, function(clonedElement, scope) {
					msg.picture.append(clonedElement);
				});
			} else {
				return;
			}
			msg.extra_css += "with_hoverimage ";
		};

		var showTitleAndPicture = function(from, msg, is_self) {
			if ($scope.isgroupchat) {
				msg.title = $("<strong>");
				msg.title.html(displayName(from, true));
				msg.extra_css += "with_name ";
				var imgSrc = buddyImageSrc(from);
				msg.picture = $('<div class="buddyPicture"><i class="fa fa-user fa-3x"/><img/></div>');
				if (imgSrc) {
					msg.picture.find("img").attr("src", imgSrc);
				}
				addPictureHover(from, msg, is_self);
			}
		};


		// Make sure that chat links are openend in a new window.
		$element.on("click", function(event) {
			var elem = $(event.target);
			if (elem.is("a")) {
				var url = elem.attr("href");
				if (url && !elem.attr("download")) {
					if (url.match(/mailto:/gi) === null) {
						event.preventDefault();
						$window.open(elem.attr("href"), "_blank");
					}
				}
			}
		});

		$scope.$watch("input", function(newvalue) {

			$scope.$parent.seen();
			$window.clearTimeout(isTypingExpired);
			if (!newvalue) {
				return;
			}
			if (!isTyping) {
				isTyping = true;
				$scope.$emit("typing", {
					who: "local",
					status: "start"
				});
			}
			isTypingExpired = $window.setTimeout(function() {
				isTyping = false;
				$scope.$emit("typing", {
					who: "local",
					status: "stop"
				});
			}, 4000);

		});

		$scope.reset = function() {
			$scope.input = "";
			isTyping = false;
			$window.clearTimeout(isTypingExpired);
		};

		$scope.focus = function() {
			$scope.inputElement.focus();
		};

		$scope.submit = function() {
			var input = $scope.input;
			if (input) {
				scrollAfterInput = true;
				$scope.$emit("submit", $scope.input);
				$scope.reset();
				$scope.focus();
			}
		};

		$scope.canScroll = function() {

			var o = $scope.outputElement[0];
			if ((o.clientHeight - 20) < o.scrollHeight) {
				if (!scrollAfterInput && (o.clientHeight + 20) < (o.scrollHeight - o.scrollTop)) {
					// Manually scrolled -> do nothing.
				} else {
					scrollAfterInput = false;
					// Return scroll function.
					return function() {
						o.scrollTop = o.scrollHeight;
					};
				}
			}
			return false;

		}

		$scope.display = function(s, nodes, extra_css, title, picture) {

			var container;
			var element;
			var scroll = this.canScroll();
			lastMessageContainer = null;

			if (!extra_css) {
				extra_css = "";
			}
			if (s || title || picture) {
				container = $('<div class="message ' + extra_css + '"></div>');
				if (title) {
					container.prepend(title);
				}
				if (picture) {
					container.prepend(picture);
				}
				lastMessageContainer = $("<ul>").appendTo(container);
				if ($.trim(s)) {
					element = $("<li>").html(s);
					element.prepend('<div class="timestamp-space">');
					element.appendTo(lastMessageContainer);
				}
			}
			if (nodes) {
				if (container) {
					// Insert at the end of previously created container.
					container.append(nodes);
				} else {
					$scope.outputElement.append(nodes);
				}
				if (container && lastMessageContainer) {
					lastMessageContainer = $("<ul>").appendTo(container);
				}
			}

			if (container) {
				$scope.outputElement.append(container);
			}

			if (scroll) {
				scroll();
			}

			return element;

		};

		$scope.$on("display", function(event, s, nodes) {
			$scope.display(s, nodes);
		});

		$scope.append = function(s, nodes) {

			if (!lastMessageContainer) {
				return;
			}

			var scroll = this.canScroll();

			var li = $("<li>");
			li.html(s)
			lastMessageContainer.append(li)

			if (nodes) {
				var parent = lastMessageContainer.parent();
				parent.append(nodes);
				lastMessageContainer = $("<ul>");
				parent.append(lastMessageContainer);
			}

			if (scroll) {
				scroll();
			}

			return li;

		};

		$scope.showtime = function(d, format, compare) {

			var m;
			if (d) {
				m = moment(d);
			} else {
				m = moment();
			}
			if (!format) {
				format = "LLL";
			}

			var datestring = m.format(format);
			if (compare && datestring === compare) {
				// Do nothing if compare matches.
				return datestring;
			}
			$scope.display(null, $("<i>" + datestring + "</i>"));
			if (!d) {
				lastSender = null;
			}
			return datestring;

		};

		$scope.showdate = function(d) {

			lastDate = $scope.showtime(d, "LL", lastDate);

		};

		$scope.showmessage = function(from, timestamp, message, nodes) {

			var sessonid = $scope.$parent.$parent.id;

			// Prepare message to display.
			var s = [];
			if (message) {
				s.push(message);
				$scope.$emit("incoming", message, from, sessonid);
			}

			var is_new_message = lastSender !== from;
			var is_self = from === sessonid;

			var msg = {
				extra_css: "",
				title: null,
				picture: null
			};

			if (is_new_message) {
				lastSender = from;
				$scope.showdate(timestamp);
				showTitleAndPicture(from, msg, is_self);
			}

			var strMessage = s.join(" ");

			if (!is_new_message) {
				var element = this.append(strMessage, nodes);
				if (element) {
					return element;
				}
				showTitleAndPicture();
			}

			if (is_self) {
				msg.extra_css += "is_self";
			} else {
				msg.extra_css += "is_remote";
			}
			if (timestamp) {
				var ts = $('<div class="timestamp"/>');
				ts.text(moment(timestamp).format("H:mm"));
				if (nodes) {
					nodes = nodes.add(ts);
				} else {
					nodes = ts;
				}
			}
			return $scope.display(strMessage, nodes, msg.extra_css, msg.title, msg.picture);

		};

		$scope.$on("seen", function() {
			knowMessage.seen();
		});

		$scope.$on("clear", function() {
			knowMessage.seen();
			lastSender = null;
			lastDate = null;
			lastMessageContainer = null;
			$scope.outputElement.empty();
		});

		$scope.$on("p2p", function(event, state) {
			//console.log("changed p2p state", state, p2p);
			var msg;
			if (state) {
				msg = translation._("Peer to peer chat active.");
			} else {
				msg = translation._("Peer to peer chat is now off.");
			}
			$scope.display(null, $("<i class='p2p'><span class='icon-exchange'></span> " + msg + "</i>"));
		});

		$scope.$on("focus", function() {
			$scope.focus();
		});

		$scope.$on("received", function(event, from, data) {

			var sessionid = $scope.$parent.$parent.id;
			var mid = data.Mid || null;

			switch (data.Type) {
				case "LeftOrJoined":
					$scope.showtime(new Date());
					if (data.LeftOrJoined === "left") {
						$scope.display(null, $("<i>" + displayName(from) + translation._(" is now offline.") + "</i>"));
					} else {
						$scope.display(null, $("<i>" + displayName(from) + translation._(" is now online.") + "</i>"));
					}
					break;
				case "Log":
					$scope.showtime(new Date());
					$scope.display(null, data.Log);
					break;
				default:

					// Definitions.
					var message = null;
					var nodes = null;
					var fromself = from === sessionid;
					var noop = false;
					var element = null;
					var subscope;

					var timestamp = data.Time;
					if (!timestamp) {
						timestamp = new Date();
					}

					// Process internal status messages.
					if (data.Status) {

						if (!mid && data.Status.Mid) {
							mid = data.Status.Mid; // Inner Mid means internal chat status.
						}

						// Typing notification.
						if (data.Status.Typing && !fromself) {
							$window.clearTimeout(peerTypingExpired);
							$scope.$emit("typing", {
								who: "peer",
								status: data.Status.Typing
							});
							if (data.Status.Typing === "stop") {
								peerTypingExpired = $window.setTimeout(function() {
									$scope.$emit("typing", {
										who: "peer",
										status: "no"
									});
								}, 20000);
							}
						}

						// Mid updates.
						if (mid && data.Status.State) {
							knowMessage.update(mid, data.Status.State);
						}

						// Mid batch updates.
						if (data.Status.SeenMids) {
							_.each(data.Status.SeenMids, function(mid) {
								knowMessage.update(mid, "received");
							});
						}

						// File offers.
						if (data.Status.FileInfo) {
							subscope = $scope.$new();
							subscope.info = data.Status.FileInfo;
							subscope.from = from;
							fileInfo(subscope, function(clonedElement, scope) {
								var text = fromself ? translation._("You share file:") : translation._("Incoming file:");
								element = $scope.showmessage(from, timestamp, text, clonedElement);
							});
							noop = true;
						}

						// Geolocation sharing.
						if (data.Status.Geolocation) {
							subscope = $scope.$new();
							subscope.info = data.Status.Geolocation;
							subscope.from = from;
							geoLocation(subscope, function(clonedElement, scope) {
								var text = fromself ? translation._("You shared your location:") : translation._("Location received:");
								element = $scope.showmessage(from, timestamp, text, clonedElement);
							});
							noop = true;
						}

						// Contact request.
						if (data.Status.ContactRequest) {
							subscope = $scope.$new();
							subscope.request = data.Status.ContactRequest;
							subscope.fromself = fromself;
							contactRequest(subscope, function(clonedElement, scope) {
								var text;
								if (fromself) {
									if (scope.request.Userid) {
										if (scope.request.Success) {
											text = translation._("You accepted the contact request.");
										} else {
											text = translation._("You rejected the contact request.");
										}
									} else {
										text = translation._("You sent a contact request.");
									}
								} else {
									if (scope.request.Success) {
										text = translation._("Your contact request was accepted.");
									} else{
										if (scope.request.Token) {
											text = translation._("Incoming contact request.");
										} else {
											text = translation._("Your contact request was rejected.");
										}
									}
								}
								element = $scope.showmessage(from, timestamp, text, clonedElement);
							});
							noop = true;
						}

						// Ignore unknown status messages.
						if (message === null && nodes === null) {
							noop = true;
						}

					}

					// Do nothing when where is nothing.
					if (!data.Message && message === null && nodes === null) {
						noop = true;
					}

					if (!noop) {
						// Default handling is to use full message with security in place.
						if (message === null && nodes === null && data.Message && typeof data.Message == "string") {
							message = safeMessage(data.Message);
						}
						// Show the beast.
						element = $scope.showmessage(from, timestamp, message, nodes);
					}

					if (element && mid && !$scope.isgroupchat) {
						knowMessage.register(element, mid, fromself ? "sending" : "unread", !fromself);
					}

					break;

			}

			// Reset last sender to allow a new time stamp after a while.
			$window.clearTimeout(senderExpired);
			senderExpired = $window.setTimeout(function() {
				lastSender = null;
			}, 61000);

		});

	}];

});
