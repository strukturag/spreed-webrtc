#
# Spreed WebRTC.
# Copyright (C) 2013-2014 struktur AG
#
# This file is part of Spreed WebRTC.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

AUTOMAKE_OPTIONS = -Wno-portability
ACLOCAL_AMFLAGS = -I m4

EXENAME := spreed-webrtc-server
CONFIG_FILE ?= spreed-webrtc-server.conf
CONFIG_PATH ?= /etc
VENDOR_GOPATH ?= $(CURDIR)/vendor
GOBUILDFLAGS ?=
GOTESTFLAGS ?=

export GOPATH = $(VENDOR_GOPATH):$(CURDIR)

SYSTEM_GOPATH := /usr/share/gocode/src/
OUTPUT := $(CURDIR)/bin
OUTPUT_JS := $(CURDIR)/build/out

DESTDIR ?= /
BIN := $(DESTDIR)/usr/sbin
CONFIG_DIR := $(DESTDIR)/$(CONFIG_PATH)
SHARE := $(DESTDIR)/usr/share/spreed-webrtc-server

BUILD_ARCH := $(shell $(GO) env GOARCH)
BUILD_OS := $(shell go env GOOS)
DIST := $(CURDIR)/dist_$(BUILD_ARCH)
DIST_SRC := $(DIST)/src
DIST_BIN := $(DIST)/bin

all: build

build: binary assets

gopath:
	@echo GOPATH=$(GOPATH)

get:
	$(GO) get app/...

getupdate: vendorclean get

binary: get
	$(GO) build $(GOBUILDFLAGS) -o $(OUTPUT)/$(EXENAME) -ldflags '$(LDFLAGS)' app/$(EXENAME)

binaryrace: GOBUILDFLAGS := $(GOBUILDFLAGS) -race
binaryrace: binary

binaryall: GOBUILDFLAGS := $(GOBUILDFLAGS) -a
binaryall: binary

fmt:
	$(GO) fmt app/...

test: get
	$(GO) test $(GOTESTFLAGS) app/...

assets: javascript fonts

releaseassets: RJSFLAGS = generateSourceMaps=false preserveLicenseComments=true
releaseassets: dist_gopath assets

fonts:
	$(MKDIR_P) $(CURDIR)/static/fonts
	cp -r $(CURDIR)/src/styles/libs/font-awesome/fonts/font* $(CURDIR)/static/fonts

javascript:
	$(MKDIR_P) $(OUTPUT_JS)
	$(NODEJS) $(CURDIR)/build/r.js \
		-o $(CURDIR)/build/build.js \
		dir=$(OUTPUT_JS) $(RJSFLAGS)

styles: fonts
	cd $(CURDIR)/src/styles && $(MAKE) styles

styleshint:
	cd $(CURDIR)/src/styles && $(MAKE) styleshint

jshint:
	@if [ "$(JSHINT)" = "" ]; then echo "Command 'jshint' not found"; exit 1; fi
	$(FIND) static/ -wholename static/js/libs -prune -o -name "*.js" -print0 | xargs -0 -n1 $(JSHINT) --config .jshint

jsbeautify:
	@if [ "$(JS_BEAUTIFY)" = "" ]; then echo "Command 'js-beautify' not found"; exit 1; fi
	$(FIND) static/ \( -path static/js/libs -o -path static/translation \) -prune -o -name "*.js" -exec $(JS_BEAUTIFY) -t -o {}.new {} \; -exec mv -f {}.new {} \;

build-i18n:
	cd $(CURDIR)/src/i18n && $(MAKE) build

extract-i18n:
	cd $(CURDIR)/src/i18n && $(MAKE) extract

update-i18n:
	cd $(CURDIR)/src/i18n && $(MAKE) update

release: GOPATH = $(DIST):$(VENDOR_GOPATH):$(CURDIR)
release: LDFLAGS = -X main.version $(PACKAGE_VERSION) -X main.defaultConfig $(CONFIG_PATH)/$(CONFIG_FILE)
release: OUTPUT = $(DIST_BIN)
release: dist_gopath $(DIST_BIN) binary releaseassets

releasetest: GOPATH = $(DIST):$(VENDOR_GOPATH):$(CURDIR)
releasetest: dist_gopath test

install:
	echo $(BIN)
	echo $(SHARE)
	$(INSTALL) -d $(BIN) $(CONFIG_DIR)
	$(INSTALL) -d $(SHARE)/www/html
	$(INSTALL) -d $(SHARE)/www/static
	$(INSTALL) -d $(SHARE)/www/static/img
	$(INSTALL) -d $(SHARE)/www/static/sounds
	$(INSTALL) -d $(SHARE)/www/static/fonts
	$(INSTALL) -d $(SHARE)/www/static/translation
	$(INSTALL) -d $(SHARE)/www/static/css
	$(INSTALL) -d $(SHARE)/www/static/js/libs/pdf
	$(INSTALL) $(DIST_BIN)/* $(BIN)
	$(INSTALL) -m 644 server.conf.in $(CONFIG_DIR)/$(CONFIG_FILE)
	$(INSTALL) html/* $(SHARE)/www/html
	$(INSTALL) static/img/* $(SHARE)/www/static/img
	$(INSTALL) static/sounds/* $(SHARE)/www/static/sounds
	$(INSTALL) static/fonts/* $(SHARE)/www/static/fonts
	$(INSTALL) static/translation/* $(SHARE)/www/static/translation
	$(INSTALL) static/css/* $(SHARE)/www/static/css
	$(INSTALL) -D static/js/libs/require/require.js $(SHARE)/www/static/js/libs/require/require.js
	$(INSTALL) $(OUTPUT_JS)/*.js $(SHARE)/www/static/js
	$(INSTALL) $(OUTPUT_JS)/libs/pdf/*.js $(SHARE)/www/static/js/libs/pdf
	$(INSTALL) -D static/js/libs/webodf.js $(SHARE)/www/static/js/libs/webodf.js

clean:
	$(GO) clean -i app/...
	rm -rf $(CURDIR)/pkg
	rm -rf $(CURDIR)/static/fonts
	rm -rf $(CURDIR)/build/out

distclean: clean
	rm -rf $(DIST)

vendorclean:
	rm -rf vendor/*

pristine: distclean vendorclean
	rm -f server.conf

$(DIST_SRC):
	$(MKDIR_P) $@

$(DIST_BIN):
	$(MKDIR_P) $@

dist_gopath: $(DIST_SRC)
	$(FIND) $(SYSTEM_GOPATH) -mindepth 1 -maxdepth 1 -type d \
			-exec ln -sf {} $(DIST_SRC) \;

tarball: TARPATH = $(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)
tarball: BIN = $(TARPATH)/loader
tarball: CONFIG_DIR = $(TARPATH)/loader
tarball: DOCS = $(CONFIG_DIR)/docs
tarball: SHARE = $(TARPATH)/
tarball: distclean release install
		echo -n $(PACKAGE_VERSION) > $(TARPATH)/version.txt
		tar czf $(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)_$(BUILD_OS)_$(BUILD_ARCH).tar.gz -C $(DIST) $(PACKAGE_NAME)-$(PACKAGE_VERSION)

.PHONY: clean distclean vendorclean pristine get getupdate build javascript fonts styles release releasetest dist_gopath install gopath binary binaryrace binaryall tarball assets
