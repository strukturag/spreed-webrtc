Spreed Speak Freely
===================

The latest version of Spreed Speak Freely can be found on GitHub:

  https://github.com/strukturag/spreed-speakfreely


## Build prerequisites

  - [Go](http://golang.org) >= 1.1.0
  - [NodeJS](http://nodejs.org/)
  - [Sass](http://sass-lang.com/) >= 3.2.0
  - [Compass](http://compass-style.org/)
  - [Babel](http://babel.pocoo.org/)
  - [po2json](https://github.com/mikeedwards/po2json)
  - make


## Building

  [![Build Status](https://travis-ci.org/strukturag/spreed-speakfreely.png?branch=master)](https://travis-ci.org/strukturag/spreed-speakfreely)

  Go, Sass and NodeJS need to be in your $PATH.

  ```bash
  $ make
  ```


## Build seperately

  Get Go external dependencies first with ``make get``.

  ```bash
  $ make styles
  $ make javascript
  $ make binary
  ```


## Server startup

  ```bash
  spreed-speakfreely-server [OPTIONS]
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


## In place start for development

  Copy the server.conf.in to server.conf.

  Build styles, javascript and binary using make. Then run
  ``./spreed-speakfreely-server``

  The server runs on http://localhost:8080/ per default.

  HTML changes and Go rebuilds need a server restart. Javascript
  and CSS reload directly.


## Production use

  Spreed Speak Freely should be run through a SSL frontend proxy with
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
4. Do your commits (run ``make fmt`` before commit).
5. Send "pull request".

## License

`Spreed Speak Freely` uses the AGPL license, see our `LICENSE` file.
