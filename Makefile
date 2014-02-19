#
# Spreed Speak Freely.
# Copyright (C) 2013-2014 struktur AG
#
# This file is part of Spreed Speak Freely.
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

PKG := app/spreed-speakfreely-server
EXENAME := spreed-speakfreely-server
CONFIG_FILE := spreed-speakfreely-server.conf
CONFIG_PATH := /etc

GOPATH = "$(CURDIR)/vendor:$(CURDIR)"
SYSTEM_GOPATH := /usr/share/gocode/src/
OUTPUT := $(CURDIR)/bin
OUTPUT_JS := $(CURDIR)/build/out

DESTDIR ?= /
BIN := $(DESTDIR)/usr/sbin
CONF := $(DESTDIR)/$(CONFIG_PATH)
SHARE := $(DESTDIR)/usr/share/spreed-speakfreely-server

BUILD_ARCH := $(shell go env GOARCH)
DIST := $(CURDIR)/dist_$(BUILD_ARCH)
DIST_SRC := $(DIST)/src
DIST_BIN := $(DIST)/bin

NODEJS_BIN := $(shell which nodejs)
ifeq ("$(NODEJS_BIN)", "")
	NODEJS_BIN := $(shell which node)
endif
NODEJS_BIN_EXISTS := $(shell [ -x "$(NODEJS_BIN)" ] && echo 1 || echo 0)
ifneq ($(NODEJS_BIN_EXISTS), 1)
    $(error "Can't find node.js runtime, please install / check your PATH")
endif

build: get binary styles javascript

gopath:
		@echo GOPATH=$(GOPATH)

get:
		GOPATH=$(GOPATH) go get $(PKG)

binary:
		GOPATH=$(GOPATH) go build -o $(OUTPUT)/$(EXENAME) -ldflags '$(LDFLAGS)' $(PKG)

binaryrace:
		GOPATH=$(GOPATH) go build -race -o $(OUTPUT)/$(EXENAME) -ldflags '$(LDFLAGS)' $(PKG)

fmt:
		GOPATH=$(GOPATH) go fmt app/...

test: TESTDEPS = $(shell GOPATH=$(GOPATH) go list -f '{{.ImportPath}}{{"\n"}}{{join .Deps "\n"}}' $(PKG) |grep $(PKG))
test: get
		GOPATH=$(GOPATH) go test -i $(TESTDEPS)
		GOPATH=$(GOPATH) go test -v $(TESTDEPS)

styles:
		(cd $(CURDIR)/src/styles && sass --compass --scss --style=compressed main.scss:$(CURDIR)/static/css/main.min.css)

javascript:
		mkdir -p $(OUTPUT_JS)
		$(NODEJS_BIN) $(CURDIR)/build/r.js -o $(CURDIR)/build/build.js dir=$(OUTPUT_JS) baseUrl=$(CURDIR)/static/js mainConfigFile=$(CURDIR)/static/js/main.js

release: GOPATH = "$(DIST):$(CURDIR)"
release: LDFLAGS = -X main.version $(VERSION) -X main.defaultConfig $(CONFIG_PATH)/$(CONFIG_FILE)
release: OUTPUT = $(DIST_BIN)
release: dist_gopath $(DIST_BIN) binary styles javascript

releasetest: GOPATH = "$(DIST):$(CURDIR)"
releasetest: dist_gopath test

install:
		echo $(BIN)
		echo $(SHARE)
		install -d $(BIN) $(CONF)
		install -d $(SHARE)/www/html
		install -d $(SHARE)/www/static
		install -d $(SHARE)/www/static/img
		install -d $(SHARE)/www/static/sounds
		install -d $(SHARE)/www/static/fonts
		install -d $(SHARE)/www/static/translation
		install -d $(SHARE)/www/static/css
		install $(DIST_BIN)/* $(BIN)
		install -m 644 server.conf.in $(CONF)/$(CONFIG_FILE)
		install html/* $(SHARE)/www/html
		install static/img/* $(SHARE)/www/static/img
		install static/sounds/* $(SHARE)/www/static/sounds
		install static/fonts/* $(SHARE)/www/static/fonts
		install static/translation/* $(SHARE)/www/static/translation
		install static/css/* $(SHARE)/www/static/css
		install -D static/js/libs/require/require.js $(SHARE)/www/static/js/libs/require/require.js
		install $(OUTPUT_JS)/*.js $(SHARE)/www/static/js

clean:
		GOPATH=$(GOPATH) go clean -i $(PKG)
		rm -rf $(CURDIR)/pkg
		rm -f $(CURDIR)/static/css/main.min.css
		rm -rf $(CURDIR)/build/out

distclean: clean
		rm -rf $(DIST)

pristine: distclean
		rm -f server.conf
		rm -rf vendor/*

$(DIST_SRC):
		mkdir -p $@

$(DIST_BIN):
		mkdir -p $@

dist_gopath: $(DIST_SRC)
		find $(SYSTEM_GOPATH) -mindepth 1 -maxdepth 1 -type d \
				-exec ln -sf {} $(DIST_SRC) \;

tarball: VERSION = $(shell dpkg-parsechangelog | sed -n 's/^Version: //p')
tarball: PACKAGE_NAME = $(EXENAME)-$(VERSION)
tarball: TARPATH = $(DIST)/$(PACKAGE_NAME)
tarball: BIN = $(TARPATH)/loader
tarball: CONF = $(TARPATH)/loader
tarball: DOCS = $(CONF)/docs
tarball: SHARE = $(TARPATH)/
tarball: distclean release install
		echo -n $(VERSION) > $(TARPATH)/version.txt
		tar czf $(DIST)/$(PACKAGE_NAME).tar.gz -C $(DIST) $(PACKAGE_NAME)

.PHONY: clean distclean pristine get build styles javascript release releasetest dist_gopath install gopath binary tarball
