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

ROOT=$(CURDIR)/../..

build: LANGUAGES = $(shell $(FIND) ./ -iname '*.po' -printf '%f\n' | $(SED) 's/\.po$$//' | $(SED) 's/\messages-//')
build: update
	@if [ "$(NODEJS_SUPPORT_PO2JSON)" = "no" ]; then echo "Node.js module 'po2json' not found, required when building i18n"; exit 1; fi
	@if [ "$(PYTHON)" = "" ]; then echo "Command 'python' not found, required when building i18n"; exit 1; fi
	$(PYTHON) "$(CURDIR)/helpers/polint.py"
	for lang in $(LANGUAGES) ; do \
		$(NODEJS) "$(CURDIR)/helpers/po2json" "$(CURDIR)/messages-$$lang.po" "$(ROOT)/static/translation/messages-$$lang.json" ; \
	done
	$(PYTHON) "$(CURDIR)/helpers/languages.py" > "$(ROOT)/static/translation/languages.js"

extract: TEMPFOLDER := $(shell mktemp -t XXXXXXXXi18n -d)
extract:
	@if [ "$(PYBABEL)" = "" ]; then echo "Command 'pybabel' not found, required when extracting i18n"; exit 1; fi
	$(PYTHON) "$(CURDIR)/helpers/checkHTML.py" "$(ROOT)/static/partials" "$(TEMPFOLDER)"
	$(PYBABEL) extract -F "$(CURDIR)/babel.cfg" --no-default-keywords -k _n:1,2 -k _ \
		--no-location --project="$(I18N_PROJECT)" --version="$(I18N_VERSION)" \
		--copyright-holder="$(I18N_COPYRIGHT)" --msgid-bugs-address="$(I18N_BUG_ADDRESS)" \
		-o "$(CURDIR)/messages.pot" \
		"$(ROOT)/html" \
		"$(TEMPFOLDER)" \
		"$(ROOT)/static/js" \
		"$(ROOT)/static/js/controllers" \
		"$(ROOT)/static/js/directives" \
		"$(ROOT)/static/js/services" \
		"$(ROOT)/static/js/filters"
	rm -rf $(TEMPFOLDER)

update: LANGUAGES = $(shell $(FIND) ./ -iname '*.po' -printf '%f\n' | $(SED) 's/\.po$$//' | $(SED) 's/\messages-//')
update:
	@if [ "$(PYBABEL)" = "" ]; then echo "Command 'pybabel' not found, required when updating i18n"; exit 1; fi
	for lang in $(LANGUAGES) ; do \
		l=$$lang ; \
		if echo $$l | $(GREP) -q -; then \
			l=`echo $$lang | $(AWK) '{split($$0,a,"-"); printf "%s_%s", a[1],toupper(a[2])}'` ; \
		fi ; \
		$(PYBABEL) update -l $$l -i "$(CURDIR)/messages.pot" -o "$(CURDIR)/messages-$$lang.po" ; \
	done
