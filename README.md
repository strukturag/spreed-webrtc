Spreed WebRTC
===================

Spreed WebRTC implements a WebRTC audio/video call and conferencing server
and web client.

The latest source of Spreed WebRTC can be found on [GitHub](https://github.com/strukturag/spreed-webrtc). If you are a user, just wanting a secure and private alternative for online communication make sure to check out the [Spreedbox](http://spreedbox.com), providing a ready to use hardware with Spreed WebRTC included.


## Build prerequisites

  - [Go](http://golang.org) >= 1.4.0
  - [NodeJS](http://nodejs.org/) >= 0.6.0
  - [autoconf](http://www.gnu.org/software/autoconf/)
  - [automake](http://www.gnu.org/software/automake/)


## Runtime dependencies

Spreed WebRTC compiles directly to native code and has no
external runtime dependencies. See [here](http://golang.org/doc/faq#How_is_the_run_time_support_implemented)
for details.


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


## Build separately

There are several make targets available. Get Go external dependencies at
least once with ``make get``, all the other targets depend on this.

```bash
$ make get
$ make assets
$ make binary
```


## Server startup

```bash
spreed-webrtc-server [OPTIONS]
```

### Options

```
-c="./server.conf": Configuration file.
-cpuprofile="": Write cpu profile to file.
-h=false: Show this usage information and exit.
-l="": Log file, defaults to stderr.
-memprofile="": Write memory profile to this file.
-v=false: Display version number and exit.
```

An example configuration file can be found in server.conf.in.


## Usage

Connect to the server URL and port with a web browser and the
web client will launch.


## Development

To build styles and translations, further dependencies are required.
The source tree contains already built styles and translations, so
these are only required if you want to make changes.

  - [NodeJS](http://nodejs.org/) >= 0.10.0
  - [Compass](http://compass-style.org/) >= 1.0.0
  - [Sass](http://sass-lang.com/) >= 3.3.0
  - [Babel](http://babel.pocoo.org/)

The following Node.js modules are required, these may be installed
locally by running `npm install` from the project root. Consult the
`package.json` file for more details.

  - [autoprefixer](https://www.npmjs.org/package/autoprefixer) >= 1.1
  - [po2json](https://github.com/mikeedwards/po2json) >= 0.4.1
  - [JSHint](http://www.jshint.com/) >= 2.0.0
  - [scss-lint](https://github.com/causes/scss-lint) >= 0.33.0

Styles can be found in src/styles. Translations are found in src/i18n.
Each folder has its own Makefile to build the corresponding files. Check the
Makefile.am templates for available make targets.

Javascript console logging is automatically _disabled_ and can be enabled by
adding the query parameter `debug` to your url `https://my_url?debug`.


## Running server for development

Copy the server.conf.in to server.conf.

Build styles, javascript and binary using make. Then run
``./spreed-webrtc-server``

The server runs on http://localhost:8080/ per default.

HTML changes and Go rebuilds need a server restart. Javascript
and CSS reload directly.


## Running for production

Spreed WebRTC should be run through a SSL frontend proxy with
support for Websockets. Example configuration for Nginx can be
found in `doc/NGINX.txt`.

In addition, for real world use, one also needs a STUN/TURN server
configured (with shared secret support).

See https://github.com/coturn/coturn for a free
open source TURN server implementation. Make sure to use a recent
version (we recommend 3.2). Versions below 2.5 are not supported.

For WebRTC usage, be sure to enable long-term credentials,
fingerprinting, and set the realm. See
https://github.com/coturn/coturn/wiki/turnserver#webrtc-usage
for more information.


## Running with Docker

We provide official Docker images at https://hub.docker.com/r/spreed/webrtc/. Of
course you can build the Docker image yourself as well. Check the Dockerfiles in
this repository for details and instructions.

Use the following command to run a Spreed WebRTC Docker container with the
default settings from our official Spreed WebRTC Docker image.

```
docker run --rm --name my-spreed-webrtc -p 8080:8080 -p 8443:8443 \
    -v `pwd`:/srv/extra -i -t spreed/webrtc
```

## Setup Screensharing

### Chrome
Chrome should work out of the box.

### Firefox

As of Firefox >= 36 you must append the domain being used to the allowed domains
to access your screen. You do this by navigating to `about:config`, search for
'media.getusermedia.screensharing.allowed_domains', and append the domain
to the list of strings. You can edit the field simply by double clicking on it.
Ensure that you follow the syntax rules of the field. If you are using an `ip:port`
url, simply append `ip` to the list. Also ensure that you are using `https`,
otherwise permission will be denied to share your screen. You do not need to restart
or reload in order for it to take affect.


## Contributing

1. "Fork" develop branch.
2. Create a feature branch.
3. Make changes.
4. Do your commits (run ``make fmt`` and ``make jshint`` before commit).
5. Send "pull request" for develop branch.


## License

`Spreed WebRTC` uses the AGPL license, see our `LICENSE` file.
