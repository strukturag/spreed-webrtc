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
SASSFLAGS = --style=compressed --no-cache --sourcemap=none
AUTOPREFIXER_BROWSER_SUPPORT := "> 1%, last 2 versions, Firefox ESR, Opera 12.1"
STATIC = ../../static

pre:
	@if [ "$(SASS)" = "" ]; then echo "Command 'sass' not found, required when building styles"; exit 1; fi
	@if [ "$(NODEJS_SUPPORT_STYLES)" = "no" ]; then echo "Your version of node.js does not support building styles"; exit 1; fi
	@if [ "$(SASS_SUPPORT_STYLES)" = "no" ]; then echo "Your version of sass does not support building styles"; exit 1; fi
	$(MKDIR_P) $(STATIC)/css

styles: bootstrap.min.css font-awesome.min.css csp.min.css main.min.css

main.min.css: pre
	@if [ "$(AUTOPREFIXER)" = "" ]; then echo "Command 'autoprefixer' not found, required when building main.css styles"; exit 1; fi
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/main.scss:$(STATIC)/css/main.min.css
	$(AUTOPREFIXER) --browsers $(AUTOPREFIXER_BROWSER_SUPPORT) $(STATIC)/css/main.min.css

bootstrap.min.css: pre
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/bootstrap.scss:$(STATIC)/css/bootstrap.min.css

font-awesome.min.css: pre
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/font-awesome.scss:$(STATIC)/css/font-awesome.min.css

csp.min.css: pre
	$(SASS) --compass --scss $(SASSFLAGS) \
		$(CURDIR)/csp.scss:$(STATIC)/css/csp.min.css

styleshint:
	@if [ "$(SASS)" = "" ]; then echo "Command 'sass' not found, required when checking styles"; exit 1; fi
	@if [ "$(SASS_SUPPORT_STYLES)" = "no" ]; then echo "Your version of sass does not support checking styles"; exit 1; fi
	$(FIND) ./ -maxdepth 1 -name "*.scss" -print0 | xargs -0 -n1 $(SASS) --compass --scss $(SASSFLAGS) -c

styleslint:
	@if [ "$(SCSS_LINT)" = "" ]; then echo "Command 'scss-lint' not found, required when linting styles"; exit 1; fi
	$(FIND) ./ -not -path "./libs/*" -name "*.scss" -print0 | xargs -0 -n1 $(SCSS_LINT) -c scss.yml
