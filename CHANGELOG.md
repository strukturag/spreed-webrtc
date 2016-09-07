## 0.28.1

  * Filter rtx support from remote SDP for Chrome <= 38
  * Fix Go 1.4 detection for minor versions
  * Bump minimal Go version
  * Fix Go 1.4 release target
  * Allow dist_gopath to fail
  * Check if system GOPATH exists
  * Add make tarball to travis


## 0.28.0

  * Update Git hooks, to auto check translations
  * Fix a bunch of translations, after checks found issues


## 0.27.2

  * Update -X arguments syntax
  * Add Docker instructions to README.md
  * Add Dockerfiles to build minimal Docker
  * Check .po files before committing.
  * Added script to check style of .po files.
  * Fixed various style issues in .po files.
  * Allow custom GOROOT to make Travis happy
  * Unset GOROOT and GOBIN in Makefile
  * Update Dockerfile to make sense
  * Bump go.uuid to 1.1.0
  * Add Go tip to travis (allowed to fail)
  * Bump Go requirement to 1.4
  * Update gorilla websocket build dependency


## 0.27.1

  * Compute 'extra.d' relative URL
  * Compare HMACs in constant time to mitigate timing attack
  * Use proper variable for extra.d folder detection
  * Add support for symlinks inside extra.d


## 0.27.0

  * Stop to use window.alert() for load errors
  * Add support for extra.d directory
  * Hide "call" button when in conference rooms. In conference rooms, everybody automatically calls each other, so there is no need for an explicit "Call" button.
  * Only install git hook if cloned from git. For source tarballs, the `.git/hooks` folder does not exist, so an error is shown when running `autogen.sh`. With this change, the hook is not installed in such cases.
  * Added API to leave a room. Previously it was only possible to leave a room by switching to another room. This change allows explicitly leaving a room without re-joining.
  * Make the room type configurable through NATS.
  * Include user status in "Joined" event. Previously, each user broadcasted the status after a "Room" event was received. This caused a short time for all other participants where the buddy list showed "Participant X" instead of the real user name.
  * Fix moving between conference rooms.
  * Try to recover from (some) lost p2p connection state. When the ICE connection state changes to "disconnected"/"failed", these calls are marked and get re-called for conferences once the connection is back and are allowed to send an "Offer" again. This works in cases where the complete connectivity is lost for one client while being in a conference once it comes back afterwards for him. Doesn't work reliably on Firefox as no "disconnected"/"failed" is triggered there.
  * Don't add dummy remote streams if call is closed.
  * Don't show "failed" error if connection was established before.
  * Major refactoring of call / conference handling. Removed difference between single peer-to-peer calls and conferences with multiple peers. There is only a single code path now that creates calls and stores them in a conference (which holds all active calls). With this also fixed some timing issues that could cause conference peers to not send or receive media streams.
  * Remove keygen usage from web client, effectlively removing certificate creation through web client (fixes #274).
  * Update AngularJS to 1.5.6
  * Update angular-ui-bootstrap to 0.13.4.
  * Update angular.js to 1.4.6.
  * Moved room type name to variable.
  * Move room type names to constants and don't expose roomworker properties.
  * Reverse data in session ids.
  * Also send "Conference" message after "Room" messages.
  * Don't send "Conference" event if user couldn't join room.
  * Use "safeApply" when handling webrtc done/stop events.
  * Always show own video when in conference room.
  * Also hide other hangup buttons in conference rooms.
  * Hide "Hangup" button in conferences.
  * Implement new API for tests.
  * Updated evaluation of Conference messages to support serverside conferences.
  * Add CSS class with current room type to body including helpers to show/hide elements.
  * Evaluate room type mapping and send Conference messages for conference rooms. The messages are trigger whenever a new user joins a conference room. For such rooms, clientside Conference messages are ignored.
  * Make mapping of room name to room type configurable.
  * Fixed wrong attribute name. Also use cached variable instead of performing attribute lookup.
  * Fixed updating state if a conference gets downgraded to p2p.
  * Fixed inconsistent PeerConference creation. There was a case where a three-party conference got downgraded to a p2p session and then upgraded to a three-party conference again, that the two remaining participants created their own PeerConference object resulting in a "split-brain" conference.
  * Move stream id creation to PeerCall. That way the streams can be registered internally and properly cleaned up on hangup.
  * spelling
  * Added translation for Russian


## 0.26.0

  * Remove go-tip from travis until it works again.
  * Update Dockerfile to Xenial base and install pinned Go dependencies (fixes #278).
  * Update README.md


## 0.25.5

  * Improve misleading log when pipelines API is enabled.
  * Pipeline API is now optional and disabled by default.
  * Update to Xenial base and install pinned Go dependencies (fixing #278).
  * Added default sink.
  * Added to and from userid to sink/pipeline API.
  * Hide pipelines web API behind a configuration flag.
  * Implement NATS sink outbound encoding.
  * Extended Pipeline manager to support Sink creation.
  * Implement sessionCreate via NATS.
  * Implemented pipeline for Offer, Candidate and Bye.


## 0.25.4

  * Wrap nats connections as reference.
  * Updated release build logic, so it works better with packaging.


## 0.25.3

  * Updated change log.


## 0.25.2

  * Support promise based play as defined in Chrome 50 - see https://developers.google.com/web/updates/2016/03/play-returns-promise
  * Always disable web worker for PDF.js and no longer rely on PDF.js catching the execption when the worker cannot be started, fixing Firefox 45+.
  * Moved NATS connecting helpers to own submodule.
  * Added outbound ringer timeout (35s).
  * Fixed make target name.
  * Refactored structure of Go source code to module and binary.
  * Reconnect NATS forever and log NATS connection events.
  * Implemented service discovery .well-known endpoint at /.well-known/spreed-configuration
  * Removed obsolete file.


## 0.25.1

  * Use new changelog to retrieve VERSION.
  * Added support for default and override config.
  * Removed obsolete file.


## 0.25.0

  * Added hints how CHANGELOG.md is created.
  * Use markdown for changelog.
  * Removed own debian folder, to avoid conflicts for packagers.
  * Trigger NATS events non blocking through buffered channel.
  * Split "release" target into binary and assets.
  * Split "install" target into binary and assets. This way packaging can later move the static assets to a separate package.
  * Brought back mediaDevices wrapper for gUM for Firefox >= 38 fixing #263 and #264.
  * Added Go 1.6.
  * Fixed tests to reflect busManager changes.
  * Added startup bus event and a NATS client id.
  * Removed auth bus event in favour of session bus event.
  * Added docstrings and cleaned up code.
  * Validate Offer and Answer content, so only events without _token key are triggered as channelling event to bus.
  * Added support for NATS pub/sub messaging to trigger channeling events for external services.
  * Added Leon to authors.
  * cryptoRand.Int / pseudoRand.Intn to generate random integer. Previous way was modulo-biased
  * Add missing characters to random string function, so we use the full upper+lowercase alphabet
  * Avoid using LDFLAGS as this might be set to unexpected values in environment.
  * Require a golang version of at least 1.3.0.
  * Only run TravisCI builds against go1.3 and tip.


## 0.24.12

  * Brought back mediaDevices wrapper for gUM for Firefox >= 38 fixing #263 and #264.


## 0.24.11

  * Stop waiting on video early if first video track is enabled but muted.
  * Use sh shebang instead of bash to be less Linux specific (#244).
  * Updated deps to no longer user code.google.com.
  * Fix wrong type for syscall.Setrlimit on FreeBSD (#244) Values are uint64 on Unix but FreeBSD uses int64 for legacy reasons.
  * Updated WebRTC adapter to 0.2.10
  * Added support to prefer VP9 video codec (works with Chrome >= 48) as experimental setting.
  * Only prefer VP9 when experiments are actually enabled.
  * Removed local getUserMedia conversion code and use the one provided by the adapter, fixing screen sharing for Chrome >= 49.
  * Firefox 44 has fixed gUM permission indicator, so limiting workaround to 43 and lower.
  * Restrict VP9 experiment to Chrome >= 48.


## 0.24.10

  * Avoid to break when there is no mediaDevices.
  * Added compatibility fix for Chrome 38 which stopped working when called from Chrome 46+ (Munge remote offer UDP/TLS/RTP/SAVPF to RTP/SAVPF).
  * Only stop user media automatically, when all tracks have ended.
  * Stop waiting on video early if first video track is enabled but muted.


## 0.24.9

  * Added support for Firefox 43 API changes.
  * Use mediaDevices API to enumarate input devices to avoid deprecation warning in Chrome.
  * Linking from the chat no longer sends the referrer to targets by using a referrer policy.
  * Chat input is now auto focused to increase usability and to reduce number of clicks required.
  * The room chat is now automatically activated when no other chat session is available and a room is joined.
  * The Makefile now supports $(DESTDIR).
  * Limit autoprefixer version to avoid build problems with newer version.
  * Code style changes to fix latedef jshint warnings. Make jshint now runs without error with latest jshint.
  * Added travis to test Go 1.5 compatibility.
  * ODF and PDF presentations now have a white background to avoid issues with files with have no background on their own.


## 0.24.8

  * Avoid to scale up screen sharing when sharing not full screen.


## 0.24.7

  * Fixed a problem where Chrome did not apply screen sharing constraints correctly and screen sharing was using a low resolution.
  * Fixed a problem where sounds used as interval could not be disabled.
  * Added window.showCiphers helper for testing WebRTC stats API.


## 0.24.6

  * Make travis run 'make test'.
  * Disable notifications on Android Chrome (see https://code.google.com/p/chromium/issues/detail?id=481856).


## 0.24.5

  * Updated ua-parser to 0.7.9.
  * Fixed errors in unit tests.
  * Added Apache HTTPD example configuration.
  * Fixed a problem where Firefox did not release media permissions.
  * More use of track API instead of stream API.
  * SignalingState changes are now triggered as event.
  * Fixed a problem where Firefox did not start the call when media permission was denied.
  * Fixed a problem where streams could not be started when they were disabled when call was started and server has renegotiation disabled.
  * Fixed a problem where the renegotiation shrine was ignored.


## 0.24.4

  * Updated German translations.
  * Fixed invalid experimental constraints.
  * Avoid to handle the main room as global room.


## 0.24.3

  * Removed deprecated API to fix Chromium 47 compatibility.
  * Improved UI usability for smaller devices.
  * Increased the width of buddy list and chat.
  * Cleaned up sized, borders and default colors.
  * Cleaned up chat ui.
  * Chat animations no longer comnsume GPU power.
  * Chat icons are now shown in their proper color again.
  * Chat arrows are displayed properly again.
  * Updated WebRTC adapter to latest version (fixing Chromium 45).
  * Fixed CSP example for Chromium 45 and later.
  * Added GPM Godebs file to track Golang dependencies.
  * Fixed a problem where screen sharing streams were not cleaned up.
  * Added support for custom type dialogs.


## 0.24.2

  * Fixed javascript load order, so compiled scripts load properly.


## 0.24.1

  * Load sandboxes on demand, generated by server.
  * ODF and PDF sandboxes now use CSP from HTTP response header.
  * No longer include obsolete sandbox stuff in base scripts.
  * Sandbox iframes are now always created on demand.
  * Don't return users twice in "Welcome" from global room.


## 0.24.0

  * Added hover actions on buddy picture in group chat.
  * Jed.js was updated to 1.1.0 including API update for translations.
  * Fixed replaced session data receive problem.
  * Chat rooms are now reenabled on certain conditions.
  * Session close notification is now always sent both directions.
  * Reorganized scss.
  * Improved null pointer handling in server code.
  * Improved server API names to follow general rules.
  * TURN and STUN data is now created in constraints service.
  * Added screen sharing support for Firefox >= 38.
  * Added video resolution selection for Firefox >= 38.
  * Split up mediastreamcontroller in multiple parts.
  * Reconnect delay is now gradually increased.
  * Added basic romm type support.
  * Server API was bumped to 1.2.
  * Added room name support (Server API 1.2).
  * Slashes are now allowed unquoted in room names.
  * Spaces are no longer stripped in room path parts.
  * Sleepy was replaced by external library Sloth.
  * Authorizing flag is now available in scope to avoid flash of sign-in button.
  * Copyright was bumped to 2015.
  * Youtube player now runs in sandboxed iframe.
  * Allow HD video constraints for Firefox >= 38.
  * Presentaion (WebODF) now runs in sandboxed iframe.
  * Example CSP was updated to work with sandboxed iframe of Youtube and WebODF.
  * Load of web fonts is now detected to avoid fouf.
  * Added support to enable Opus DTX constraint.
  * Fixed problem where a stream without audio was added to audio processor.
  * Added support for renegotiation to web client.
  * Added audio only styles in web client.
  * Receiver can now receive a connection without a stream.
  * Youtube playback now has error handling.
  * Avoid some fout.
  * Firefox will now hang up on renegotiation (if enabled).
  * Styles were split up, so they can be built seperately.
  * Fixed a problem, where Chrome thought it already had an offer.


## 0.23.8

  * Session subscriptions now notify close both ways.
  * Reenable chat rooms on certain conditions related to peer connectivity.
  * Fixed an issue where replaced sessions cannot receive data from contacts in other rooms.


## 0.23.7

  * Updated SCSS to match coding style.
  * Updated sjcl.js to 1.0.2.
  * Fixed possible reconnect loop.
  * TURN Ttl refresh timer is no longer lost when a room was joined.
  * Fixed a possible dead lock when a hanging connection was replaced.
  * Fixed authentication id logging.
  * Avoid broken local video aspect ratio when camera changes aspect ratio while capturing (Mac OS).
  * 1080p and 720p now can fail back to lower resolution when the camera fails to provide the requested resolution.
  * Chat messages are now limited to 200k characters in web client.
  * Channeling API now discards all incoming messages larger than 1MB.
  * Video component now corretly exits from full screen in all cases.


## 0.23.6

  * Fixed Youtube module.
  * Contacts is now a module and can be disabled in server configuration.
  * Fixed stereo send support.
  * Improved Firefox support and added support for Firefox 36 and later.
  * Dropped support for Chrome < 34.
  * Account button in settings now use button style.
  * Added support for scss-lint validation.
  * Text.js was updated.
  * CPU overuse detection (Chrome) is no longe experimental and now enabled by default.


## 0.23.5

  * No longer install config file in install target of Makefile. We leave it to the packaging.
  * Sessions are no longer cleaned up when another connection replaced the session and a stale connection gets disconnected after that.


## 0.23.4

  * Cleanup of README.
  * Fixed a problem where videos were not sized correctly.
  * Lodash was updated to 3.0.0.
  * Server now has an option to require authentication to join rooms.
  * Screen sharing, youtube and presentation modules can now be disabled in server.conf.
  * Fixed position of buddy list loader animation.
  * Fixed loaded of anonymous user data when a plugin uses the authorization api.
  * Refactored session cleanup to fix ghost sessions.
  * Reorganization to allow better app support.
  * Updated require.js and r.js to 2.1.5.
  * Fixed room reset when default room is disabled.


## 0.23.3

  * Improved room bar room change and leave buttons.
  * Never hide room bar completely.
  * Stay in prior room when join fails.
  * Stay in prior room when PIN prompt was aborted.
  * Updated to PDF.js 1.0.907.
  * Enhanced example CSP to support for PDF and WebODF presentations.
  * Fixed Firefox screen sharing interop.
  * Fixed Firefox file transfer interop.
  * Fixed peer connection to create and offer when user media failed.
  * Only show room bar when there is no peer.
  * Hide welcome screen when there is a peer.
  * Avoid dead ends in room join UI when connection is lost and reestablished.
  * Avoid showing settings automatically when not connected or still in authorizing phase.
  * Added some missing CSS classes to allow easier UI mods.


## 0.23.2

  * Do not build combined Javascript in strict mode to avoid compatibility issues.


## 0.23.1

  * Fixed strict mode on release compile.
  * Fixed prefix support of make install.


## 0.23.0

  * Added support for renegotation in web client (disabled).
  * Rooms were refactored to be able to confirm joins.
  * Added support to PIN lock rooms (server side).
  * Updated javascript to follow now jshin rules.
  * Updated plugin API to make the main App object available.
  * Refactored server side configuration loading.
  * Improved usability of image upload positioning and scaling.
  * Stream lined third party javascript to reduce size.
  * Javascript is now using 'strict' mode everywhere.
  * Added suppport for Content Security Policy (CSP).
  * Added Javascript source mappings where missing.
  * Fixed bye handling in conferences to avoid endless dial tones.
  * Added support for audio and/or video only connections when
    the corresponding device is not there.
  * Several icons were changed for usability reasons.
  * Improved dialogs and texts for usability reasons.
  * Room bar is now automatically visible when not in a call.
  * Updated auto focus behavior of room select forms.
  * Implemented a room history on welcome screen.
  * Added a sign in button to the top bar.
  * Changed order of settings form for usability reasons.
  * Missed call toast now always is shown.
  * Improved toast notification styles.


## 0.22.8

  * Removed opacity transition from chat pane to avoid compositing issues.
  * Fixed timeout of usermedia test.
  * UI update fps reduces to 10 (was 60).
  * Buddy picture file upload input is now cleared after cancel.
  * Make sure to stop stream after testing usermedia.
  * Several small UI alignment issues.


## 0.22.7

  * Fixed a typo in getStreamById api.
  * Roombar visibility is now controlled by layout.
  * Removed audio mirror option which does not seem to work anywhere.
  * Fixed po2json detection when it is installed globally.
  * Dialog service is now using the ui-bootstrap defaults properly.
  * Fixed an issue where incoming chat messages failed when getting called from the sender at the same time.
  * No longer use dpkg-parsechangelog on configure.


## 0.22.6

  * Added missing gear to remove streams from peer connections.
  * FireFox no longer shows remove videos multiple times.
  * Added information about session id to REST documentation.
  * Added a bunch of experimental audio and video settings (disabled by default).
  * Added an option to automatically use same device for output as is used for input (Windows only and enabled by default).


## 0.22.5

  * Fixed an issue where the own video was not showing in democrazy layout.
  * Own video is no longer delayed in democrazy layout.


## 0.22.4

  * Optimized Makefile and cleaned up building.
  * WebODF was updated to ## 0.5.4.
  * Video layout 'classroom' has been added.
  * Video layout 'smally' is now using black background.
  * Several smaller layout improvements.
  * Room names can now start with @,$ and + without beeing quoted.
  * The online indicator can now be customized with a directive.
  * Video layout 'democrazy' has been implemented and is used per default.
  * Video layout 'onepeople' is now selectable als "Large view".
  * The own audio level indicator is now visible again.


## 0.22.3

  * Enable 1080p capturing for Chrome 38+.
  * Added option to use 8 FPS video capturing.
  * Visibly.js was updated.
  * Use cam/mic icon without slash when not disabled.
  * Fixed Chrome 38 max-height issue.
  * Fixed chat room buddy image border.
  * Fixed store of captured buddy picture when nothing else was changed.
  * Fixed fast reenable of local video (added timeout).
  * Fixed issue where a failed peer connection did hangup the whole conference.
  * Added video layout self portrait.
  * Fixed call state resurrection when there was a heartbeat timeout.


## 0.22.2

  * Fixed room join after reconnect.


## 0.22.1

  * Fixed load of local stored date when not logged in.


## 0.22.0

  * WebODF was updated to 0.5.2.
  * Multiple bugfixes and improvements to YouTube player.
  * Retrieving local user media now has a timeout.
  * Top bar controls are now correctly aligned.
  * Added support for promises during initialization code.
  * Added support for plugin provided translations.
  * Stream lined reconnects.
  * Improved status update performance and avoid to do
    several during connect/authentication phase.
  * Increased timeout to wait for remote video.
  * Screen sharing extension waiter timeout fixed.
  * Added support to upload pictures from file for own image.
  * Auto focus create room button and added enter support.
  * Angular was updated to 1.2.23.
  * Simplified base controller injection.
  * Local user data is now stored encrypted.
  * Refactored settings service and form.
  * Fixed compatibility with Sass 3.4 (now requires 3.4).
  * Howler was updated to 1.1.25.
  * Settings are now only stored when something was changed.
  * The web app now generates a random id on startup.
  * Desktop notify was updated to latest master.
  * Validate HTML templates on translation.
  * Language code can now be provided as query parameter.
  * JQuery inject-css was updated to latest master.
  * Show GPS accuracy as kilometers if required.
  * Contacts can now be modified from the contacts manager.
  * Added top bar button to open the contacts list.
  * Fixed scaling of contact images.
  * Fixed chat room resume when it was previously deleted.


## 0.21.0

  * The language is now available in appData service.
  * Implemented YouTube video sharing.
  * Fixed userid resets on soft close.
  * Show proper error message if screen sharing fails.
  * Implemented inline install hooks for Chrome extension.
  * Presentations now support ODF format with help of WebODF.
  * Implemented Chrome exension bridge API.
  * Implemented deferred based initialization service.
  * Buddy images can now be larger and are scaled down.
  * Fixed presentation multiple downloads.
  * Updated notification image to use CSS.
  * Improved top bar styles and behaviour on small screens.
  * Top bar is now a bootstrap nav bar.
  * Contacts can now be removed in contact manager.
  * Various other bug fixes.


## 0.20.0

  * Added presentation mode.
  * Added geolocation sharing in chat.
  * Muliple updates to 3rd party libraries.
  * New welcome screen.
  * Implmeneted session subscription.
  * Reorganized styles.
  * Icon changes.
  * Added ES5 detection on startup.
  * Implemented a contact manager.


## 0.19.1

  * Added Dockerfile.
  * Updates to compile time dependencies.
  * Session data no longer overwrites contact data.


## 0.19.0

  * Implemented authenticated sessions.
  * Implemented contacts.
  * Implemented aggregated sessions in buddy list.
  * Implemented contact and attestation tokens to fetch contact
    details/sessions with such a token.
  * Tokens are now AES encrypted where appropriate.
  * New ui workflow to take your own picture in settings.
  * Fixed plugins for english language.
  * Implemented event hub in appData.
  * Updates to various base libraries.
  * Added support for external plugins.
  * Added support to inject additional settings from plugins.
  * Translation updates to German, Chinese and Japanese.
  * Multiple bug fixes.
  * Improved build system autoconf detections.


## 0.18.1

  * Added autoconf/automake support.
  * Build SCSS compressed in release mode.


## 0.18.0

  * The project is now named Spreed WebRTC. All reference to the old
    name Spreed Speak Freely have been replaced.
  * Cleanup of Javascript code to match coding guide lines.
  * Added various new targets to make to check javascript and scss code.


## 0.17.5

  * Implemented server side support for user authentication and authorization.
  * Added an REST API end point (see docs).
  * Settings are now implicitly stored.
  * Javascript console log is now disabled per default. Enable with ?debug
    URL parameter or by typing debug(true) in console.
  * The integrated TLS server can now provide TLS client authentication.
  * Updated example plugins to latest APIs.
  * Bootstrap and FontAwesome are now compiled on build from SCSS sources.
  * All styles now use a common set of variables for colors and font sizes.
  * Removed vendor prefixes from scss and generate them on build with
    the autoprefixes utility.
  * Fixed compatibility with mobile Safari < 6 which did not load.
  * Fixed compatibility with Firefox in case the Firefox peer has no camera.
  * Settings do now auto open on start when there is no display name set.
  * The accept a call button does now share in sync with the ringing sound.
  * Added support to specify the default language by URL parameter (?lang=en).
  * Added support for .webp images as buddy images.


## 0.17.4

  * Updated Japanese translation.
  * Allow Makefile variables CONFIG_FILE and CONFIG_PATH.
  * Fixed a possible conference connection issue when all ICE connected were successfull.
  * Videos are now properly aligned to window top.
  * Top bar buttons no longer overlap.
  * Use onepeople audio video renderer per default.
  * Added support for native HTTPS server.
  * Fixed a data channel not ready error.
  * Use new video layout implementation to draw when there is a main view.
  * Added UI controls to switch video layout.
  * Made the conferencekiosk renderer mode working and enabled it in Ui.
  * Use new websocket.Upgraded API.
  * No longer hang up on reload when not confirmed.


## 0.17.3

  * Buddy images are now loaded with seperate URL calls.
  * Updated Korean (ko) language.
  * Fixed video bottom overflow with certain window sizes.
  * Own video is now always at the bottom.
  * Bar does no longer overlap.
  * Added new top level Make target for building assets.
  * File permission fixes.
  * Do not use sleepy as submodule but include it directly.
  * Refactored video layout renderer in seperate service.
  * Implemented alternaitve conference view (not enabled yet).


## 0.17.2

  * Fixed timeouts when there was a disconnect.
  * Use sleepy as submodule from external source.
  * Fixed file download ending prematurely on slow connections.
  * Fixed buddy list auto hide on room changes.
  * Fixed German language translation headers.
  * Added missing translation for conferences.
  * Added Japanese language.
  * Added Chinese Traditional language.
  * Updated Chinese language.
  * Updated Korean language.
  * Fixed screen sharing scrolling.
  * Fixed screen sharing hangup in conferences.
  * Avoid spurious bye ping pong.
  * Fixed hangup in conferences.
  * Fixed double click on Chrome OS.
  * Fixed buddy list visibility if it should auto hide.
  * Fixed Javascript code injection with room names.
  * Show current room name in title.


## 0.17.1

  * Added translations for Korean and Chinese.
  * Multiple updates to 3rd party js libraries.
  * Removed 1080p configuration option.
  * Bootstrap update to 3.1.1.
  * No longer disconnect ongoing calls on websocket disconnect.


## 0.17.0

  * TURN user names now use expiration time stamp. This fixes compatibility
    with latest TURN REST specification and requires a reasonably recent
    TURN server (eg. rfc5766-turn-server >= 2.5)..
  * Fixed iceServers response to be an array for Chrome >= 34.
  * Always make screen sharing availble when browser supports it.
  * Fixed audio indicator to actually work correctly.
  * Added support for screen sharing options (fit screen).
  * HTML fixes.
  * Added method to generate URL-safe random string.
  * Use strong random number generator.
  * Support configuring pprof HTTP server.


## 0.16.1

  * Implemented chat session control UI.
  * Layout controller refactorization.
  * Chat UI bugfixes.


## 0.16.0

  * Chat UI improvements.
  * Screen sharing is now a scroll pane and no longer scaled down.
  * Buddy list now auto hides when in a call.
  * Server optimizations to handle large amounts of connections better.
  * Server code was reviewed and fixed where required.
  * Changed Makefile to allow tarball and release builds with
    local third party sources in ./vendor too.
  * Added configration for maxfd and automatically use the
    numer of cpus for GOMAXPROCS per default.
  * Added server helper for stats and profiling.


## 0.15.0

  * Initial public release.
