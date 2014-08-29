Spreed WebRTC
===================

The latest version of Spreed WebRTC can be found on GitHub:

  https://github.com/strukturag/spreed-webrtc


## Build prerequisites

  - [Go](http://golang.org) >= 1.1.0
  - [NodeJS](http://nodejs.org/) >= 0.6.0
  - [autoconf](http://www.gnu.org/software/autoconf/)
  - [automake](http://www.gnu.org/software/automake/)


## Runtime dependencies

  Spreed WebRTC compiles directly to native code and has no
  external runtime dependencies. See http://golang.org/doc/faq#How_is_the_run_time_support_implemented for details.


## Building

  [![Build Status](https://travis-ci.org/strukturag/spreed-webrtc.png?branch=master)](https://travis-ci.org/strukturag/spreed-webrtc)

  If you got spreed-webrtc from the git repository, you will first need
  to run the included `autogen.sh` script to generate the `configure`
  script.

  Configure does try to find all the tools on your system at the standard
  locations. If the dependencies are somewhere else, add the corresponding
  parameters to the ./configure call.

  ```bash
  $ ./configure
  $ make
  ```


## Build seperately

  Get Go external dependencies first with ``make get``.

  ```bash
  $ make assets
  $ make binary
  ```


## Server startup

  ```bash
  spreed-webrtc-server [OPTIONS]
  ```

  Options

    -c="./server.conf": Configuration file.
    -cpuprofile="": Write cpu profile to file.
    -h=false: Show this usage information and exit.
    -l="": Log file, defaults to stderr.
    -memprofile="": Write memory profile to this file.
    -v=false: Display version number and exit.

  An example configuration file can be found in server.conf.in.


## Usage

  Connect to the server URL and port with a web browser and the
  web client will launch.


## Development

  To build styles and translations, further dependencies are required.
  The source tree contains already built styles and translations, so
  these are only required if you want to make changes.

  - [NodeJS](http://nodejs.org/) >= 0.10.0
  - [JSHint](http://www.jshint.com/) >= 2.0.0
  - [Sass](http://sass-lang.com/) >= 3.4.0
  - [Compass](http://compass-style.org/)
  - [autoprefixer](https://www.npmjs.org/package/autoprefixer) 1.1
  - [Babel](http://babel.pocoo.org/)
  - [po2json](https://github.com/mikeedwards/po2json)

  Styles can be found in src/styles. Translations are found in src/i18n.
  Each folder has its own Makefile to build the corresponding files.


## Running server for development

  Copy the server.conf.in to server.conf.

  Build styles, javascript and binary using make. Then run
  ``./spreed-webrtc-server``

  The server runs on http://localhost:8080/ per default.

  HTML changes and Go rebuilds need a server restart. Javascript
  and CSS reload directly.


## Branding

  Insert logo in `static/img`. Edit `src/styles/global/_branding.scss` to link
  to desired custom logo. It is also possible to insert the raw svg data.


## Skins

  Insert skins in `src/styles/global/skins` and edit the `@import "skins/light";`
  line in `src/styles/global/_variables.scss`. Available skins are light and
  dark. It is recommended to create a new skin file if you wish to customize
  colors.


## Running for production

  Spreed WebRTC should be run through a SSL frontend proxy with
  support for Websockets. Example configuration for Nginx can be
  found in `doc/NGINX.txt`.

  In addion for real work use one also needs a STUN/TURN server
  configured with shared secret support.

  See https://code.google.com/p/rfc5766-turn-server/ for a free
  open source TURN server implementation. Make sure to use a recent
  version (We recommend 3.2). Versions below 2.5 are not supported.


## Contributing

1. "Fork".
2. Make a feature branch.
3. Make changes.
4. Do your commits (run ``make fmt`` and ``make jshint`` before commit).
5. Send "pull request".


## License

`Spreed WebRTC` uses the AGPL license, see our `LICENSE` file.
