#!/usr/bin/python
# -*- coding: UTF-8 -*-
# Generate simple languages JSON module.

LANGUAGES = {
	"de": "Deutsch",
	"en": "English",
	"es": "Español",
	"fr": "Français",
	"it": "Italiano",	
	"ja": "日本語",
	"ko": "한국어",
	"ru": "Русский",
	"tr": "Türkçe",
	"zh-cn": "中文（简体）",
	"zh-tw": "繁體中文",
}

import json

def main():

	print """// This file is auto generated, do not modify.
"use strict";
define([], function() {
return %s;
});""" % json.dumps(LANGUAGES)

if __name__ == "__main__":
	main()
