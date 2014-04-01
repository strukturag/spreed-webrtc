VERSION := "1.0"
PROJECT := "Spreed Speak Freely"
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
	$(PYBABEL) extract -F babel.cfg -k _n:1,2 -k _ \
		--no-location --project=$(PROJECT) --version=$(VERSION) \
		--copyright-holder=$(COPYRIGHT) --msgid-bugs-address=$(EMAIL) \
		-o messages.pot \
		$(ROOT)/html \
		$(ROOT)/static/partials \
		$(ROOT)/static/partials/page \
		$(ROOT)/static/js/ \
		$(ROOT)/static/js/controllers \
		$(ROOT)/static/js/directives \
		$(ROOT)/static/js/services

update:
	for lang in $(LANGUAGES) ; do \
		$(PYBABEL) update -l $$lang -i messages.pot -o messages-$$lang.po ; \
	done

