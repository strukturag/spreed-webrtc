AUTOMAKE_OPTIONS = -Wno-portability

PKG := app/spreed-webrtc-server
EXENAME := spreed-webrtc-server
CONFIG_FILE ?= spreed-webrtc-server.conf
CONFIG_PATH ?= /etc

VENDOR = "$(CURDIR)/vendor"
GOPATH = "$(VENDOR):$(CURDIR)"

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

# Tools
AUTOPREFIXER_BROWSER_SUPPORT := "> 1%, last 2 versions, Firefox ESR, Opera 12.1"

all: build

build: get binary assets

gopath:
	@echo GOPATH=$(GOPATH)

get:
	GOPATH=$(GOPATH) $(GO) get $(PKG)

getupdate:
	rm -rf vendor/*
	GOPATH=$(GOPATH) $(GO) get $(PKG)

binary:
	GOPATH=$(GOPATH) $(GO) build -o $(OUTPUT)/$(EXENAME) -ldflags '$(LDFLAGS)' $(PKG)

binaryrace:
	GOPATH=$(GOPATH) $(GO) build -race -o $(OUTPUT)/$(EXENAME) -ldflags '$(LDFLAGS)' $(PKG)

binaryall:
	GOPATH=$(GOPATH) $(GO) build -a -o $(OUTPUT)/$(EXENAME) -ldflags '$(LDFLAGS)' $(PKG)

fmt:
	GOPATH=$(GOPATH) $(GO) fmt app/...

test: TESTDEPS = $(shell GOPATH=$(GOPATH) $(GO) list -f '{{.ImportPath}}{{"\n"}}{{join .Deps "\n"}}' $(PKG) | $(GREP) $(PKG))
test: get
	GOPATH=$(GOPATH) $(GO) test -i $(TESTDEPS)
	GOPATH=$(GOPATH) $(GO) test -v $(TESTDEPS)

assets: styles javascript

styles: SASSFLAGS = --style=expanded
styles:
	$(MKDIR_P) $(CURDIR)/static/css
	$(MKDIR_P) $(CURDIR)/static/fonts
	cp -r $(CURDIR)/src/styles/libs/font-awesome/fonts/font* $(CURDIR)/static/fonts
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/src/styles/main.scss:$(CURDIR)/static/css/main.min.css
	$(AUTOPREFIXER) --browsers $(AUTOPREFIXER_BROWSER_SUPPORT) $(CURDIR)/static/css/main.min.css
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/src/styles/bootstrap.scss:$(CURDIR)/static/css/bootstrap.min.css
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/src/styles/font-awesome.scss:$(CURDIR)/static/css/font-awesome.min.css

styleshint:
	$(FIND) src/styles -maxdepth 1 -name "*.scss" -print0 | xargs -0 -n1 $(SASS) --compass --scss $(SASSFLAGS) -c

releaseassets: RJSFLAGS = generateSourceMaps=false preserveLicenseComments=true
releaseassets: SASSFLAGS = --style=compressed --no-cache
releaseassets: dist_gopath assets

javascript:
	$(MKDIR_P) $(OUTPUT_JS)
	$(NODEJS) $(CURDIR)/build/r.js \
		-o $(CURDIR)/build/build.js \
		dir=$(OUTPUT_JS) $(RJSFLAGS)

jshint:
	@if [ "$(JSHINT)" = "" ]; then echo "Command 'jshint' not found"; exit 1; fi
	$(FIND) static/ -wholename static/js/libs -prune -o -name "*.js" -print0 | xargs -0 -n1 $(JSHINT) --config .jshint

jsbeautify:
	@if [ "$(JS_BEAUTIFY)" = "" ]; then echo "Command 'js-beautify' not found"; exit 1; fi
	$(FIND) static/ \( -path static/js/libs -o -path static/translation \) -prune -o -name "*.js" -exec $(JS_BEAUTIFY) -t -o {}.new {} \; -exec mv -f {}.new {} \;

release: GOPATH = "$(DIST):$(VENDOR):$(CURDIR)"
release: LDFLAGS = -X main.version $(PACKAGE_VERSION) -X main.defaultConfig $(CONFIG_PATH)/$(CONFIG_FILE)
release: OUTPUT = $(DIST_BIN)
release: dist_gopath $(DIST_BIN) binary releaseassets

releasetest: GOPATH = "$(DIST):$(VENDOR):$(CURDIR)"
releasetest: dist_gopath test

install:
	echo $(BIN)
	echo $(SHARE)
	$(INSTALL) -d $(BIN) $(CONF)
	$(INSTALL) -d $(SHARE)/www/html
	$(INSTALL) -d $(SHARE)/www/static
	$(INSTALL) -d $(SHARE)/www/static/img
	$(INSTALL) -d $(SHARE)/www/static/sounds
	$(INSTALL) -d $(SHARE)/www/static/fonts
	$(INSTALL) -d $(SHARE)/www/static/translation
	$(INSTALL) -d $(SHARE)/www/static/css
	$(INSTALL) $(DIST_BIN)/* $(BIN)
	$(INSTALL) -m 644 server.conf.in $(CONF)/$(CONFIG_FILE)
	$(INSTALL) html/* $(SHARE)/www/html
	$(INSTALL) static/img/* $(SHARE)/www/static/img
	$(INSTALL) static/sounds/* $(SHARE)/www/static/sounds
	$(INSTALL) static/fonts/* $(SHARE)/www/static/fonts
	$(INSTALL) static/translation/* $(SHARE)/www/static/translation
	$(INSTALL) static/css/* $(SHARE)/www/static/css
	$(INSTALL) -D static/js/libs/require/require.js $(SHARE)/www/static/js/libs/require/require.js
	$(INSTALL) $(OUTPUT_JS)/*.js $(SHARE)/www/static/js

clean:
	GOPATH=$(GOPATH) $(GO) clean -i $(PKG)
	rm -rf $(CURDIR)/pkg
	rm -rf $(CURDIR)/static/css
	rm -rf $(CURDIR)/static/fonts
	rm -rf $(CURDIR)/build/out

distclean: clean
	rm -rf $(DIST)

pristine: distclean
	rm -f server.conf
	rm -rf vendor/*

$(DIST_SRC):
	$(MKDIR_P) $@

$(DIST_BIN):
	$(MKDIR_P) $@

dist_gopath: $(DIST_SRC)
	$(FIND) $(SYSTEM_GOPATH) -mindepth 1 -maxdepth 1 -type d \
			-exec ln -sf {} $(DIST_SRC) \;

tarball: TARPATH = $(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)
tarball: BIN = $(TARPATH)/loader
tarball: CONF = $(TARPATH)/loader
tarball: DOCS = $(CONF)/docs
tarball: SHARE = $(TARPATH)/
tarball: distclean release install
		echo -n $(PACKAGE_VERSION) > $(TARPATH)/version.txt
		tar czf $(DIST)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)_$(BUILD_OS)_$(BUILD_ARCH).tar.gz -C $(DIST) $(PACKAGE_NAME)-$(PACKAGE_VERSION)

.PHONY: clean distclean pristine get getupdate build styles javascript release releasetest dist_gopath install gopath binary binaryrace binaryall tarball assets
