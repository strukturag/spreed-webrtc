VERSION := "1.0"
PROJECT := "Spreed WebRTC"
COPYRIGHT := "struktur AG"
EMAIL := "simon@struktur.de"
ROOT := "$(CURDIR)/../.."
LANGUAGES := $(shell find ./ -iname '*.po' -printf '%f\n' | sed 's/\.po$$//' | sed 's/\messages-//')

# Tools
NODEJS := nodejs
PYBABEL := pybabel
NODE_PATH := /usr/local/lib/node_modules:/usr/lib/node_modules
PYTHON := python

build: update
	for lang in $(LANGUAGES) ; do \
		NODE_PATH=$(NODE_PATH) $(NODEJS) helpers/po2json messages-$$lang.po $(ROOT)/static/translation/messages-$$lang.json ; \
	done
	$(PYTHON) helpers/languages.py >$(ROOT)/static/translation/languages.js

extract:
	$(PYBABEL) extract -F babel.cfg --no-default-keywords -k _n:1,2 -k _ \
		--no-location --project=$(PROJECT) --version=$(VERSION) \
		--copyright-holder=$(COPYRIGHT) --msgid-bugs-address=$(EMAIL) \
		-o messages.pot \
		$(ROOT)/html \
		$(ROOT)/static/partials \
		$(ROOT)/static/partials/page \
		$(ROOT)/static/js/ \
		$(ROOT)/static/js/controllers \
		$(ROOT)/static/js/directives \
		$(ROOT)/static/js/services \
		$(ROOT)/static/js/filters

update:
	for lang in $(LANGUAGES) ; do \
		l=$$lang ; \
		if echo $$l | grep -q -; then \
			l=`echo $$lang | awk '{split($$0,a,"-"); printf "%s_%s", a[1],toupper(a[2])}'` ; \
		fi ; \
		$(PYBABEL) update -l $$l -i messages.pot -o messages-$$lang.po ; \
	done

