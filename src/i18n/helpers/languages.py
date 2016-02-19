#!/usr/bin/python
# -*- coding: UTF-8 -*-
# Generate simple languages JSON module.

LANGUAGES = {
	"en": "English",
	"de": "Deutsch",
	"zh-cn": "中文（简体）",
	"zh-tw": "繁體中文",
	"ko": "한국어",
	"ja": "日本語",
	"ru": "Русский",
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
