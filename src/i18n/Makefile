VERSION := "1.0"
PROJECT := "Spreed Speak Freely"
COPYRIGHT := "struktur AG"
EMAIL := "simon@struktur.de"
ROOT := "$(CURDIR)/../.."

# Tools
NODEJS := nodejs
PYBABEL := pybabel
NODE_PATH := /usr/local/lib/node_modules:/usr/lib/node_modules

extract:
	$(PYBABEL) extract -F babel.cfg -k _n:1,2 -k _ \
		--no-location --project=$(PROJECT) --version=$(VERSION) \
		--copyright-holder=$(COPYRIGHT) --msgid-bugs-address=$(EMAIL) \
		-o messages.pot \
		$(ROOT)/html \
		$(ROOT)/static/partials \
		$(ROOT)/static/js/ \
		$(ROOT)/static/js/controllers \
		$(ROOT)/static/js/directives \
		$(ROOT)/static/js/services

update:
	$(PYBABEL) update -l de -i messages.pot -o messages-de.po

build: update
	NODE_PATH=$(NODE_PATH) $(NODEJS) helpers/po2json messages-de.po $(ROOT)/static/translation/messages-de.json