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
GOBUILDFLAGS ?=
GOTESTFLAGS ?=

BIN ?= @prefix@/sbin
SHARE ?= @prefix@/share/spreed-webrtc-server

OUTPUT := $(CURDIR)/bin
OUTPUT_JS := $(CURDIR)/build/out

BUILD_ARCH := $(shell $(GO) env GOARCH)
BUILD_OS := $(shell go env GOOS)
DIST := $(CURDIR)/dist_$(BUILD_ARCH)
DIST_SRC := $(DIST)/src
DIST_BIN := $(DIST)/bin

all: build

build: binary assets

gopath:
	@echo GOPATH=$(GOPATH)

if READONLY_VENDOR_GOPATH
export GOPATH = $(DIST):$(CURDIR)
get: $(DIST)
	ln -sf $(VENDOR_GOPATH)/src -t $(DIST)
else
export GOPATH = $(VENDOR_GOPATH):$(CURDIR)
get:
endif
	$(GO) get app/...

getupdate: vendorclean get

binary: get
	$(GO) build $(GOBUILDFLAGS) -o bin/$(EXENAME) -ldflags '$(LDFLAGS)' app/$(EXENAME)

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
releaseassets: assets

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

styleslint:
	cd $(CURDIR)/src/styles && $(MAKE) styleslint

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

release: LDFLAGS = -X main.version $(PACKAGE_VERSION) -X main.defaultConfig $(CONFIG_PATH)/$(CONFIG_FILE)
release: OUTPUT = $(DIST_BIN)
release: $(DIST_BIN) binary releaseassets

install:
	@echo "Installing binaries to: $(BIN)"
	@echo "Installing static resources to: $(SHARE)"
	$(INSTALL) -d $(BIN)
	$(INSTALL) -d $(SHARE)/www/html
	$(INSTALL) -d $(SHARE)/www/static
	$(INSTALL) -d $(SHARE)/www/static/img
	$(INSTALL) -d $(SHARE)/www/static/sounds
	$(INSTALL) -d $(SHARE)/www/static/fonts
	$(INSTALL) -d $(SHARE)/www/static/translation
	$(INSTALL) -d $(SHARE)/www/static/css
	$(INSTALL) -d $(SHARE)/www/static/js/libs/pdf
	$(INSTALL) -d $(SHARE)/www/static/js/sandboxes
	$(INSTALL) bin/$(EXENAME) $(BIN)
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
	$(INSTALL) $(OUTPUT_JS)/sandboxes/*.js $(SHARE)/www/static/js/sandboxes

clean:
	$(GO) clean -i -r app/... 2>/dev/null || true
	rm -rf $(CURDIR)/static/fonts
	rm -rf $(CURDIR)/build/out
	rm -f $(CURDIR)/bin/$(EXENAME)

distclean: clean
	rm -rf $(DIST)

vendorclean:
	rm -rf vendor/*

pristine: distclean vendorclean
	rm -f server.conf

$(DIST):
	$(MKDIR_P) $@

$(DIST_BIN):
	$(MKDIR_P) $@

tarball: TARPATH = $(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)
tarball: BIN = $(TARPATH)/loader
tarball: DOCS = $(TARPATH)/loader/docs
tarball: SHARE = $(TARPATH)/
tarball: distclean release install
		echo -n $(PACKAGE_VERSION) > $(TARPATH)/version.txt
		cp server.conf.in $(TARPATH)/loader
		tar czf $(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)_$(BUILD_OS)_$(BUILD_ARCH).tar.gz -C $(DIST) $(PACKAGE_NAME)-$(PACKAGE_VERSION)

.PHONY: clean distclean vendorclean pristine get getupdate build javascript fonts styles release releasetest dist_gopath install gopath binary binaryrace binaryall tarball assets
