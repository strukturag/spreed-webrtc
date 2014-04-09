#!/usr/bin/python
# -*- coding: UTF-8 -*-
# Generate simple languages JSON module.

LANGUAGES = {
	"en": "English",
	"de": "Deutsch",
	"zh-cn": "中文（简体）",
	"ko": "한국어",
	"ja": "日本語",
}

import json

def main():

	print """// This file is auto generated, do not modify.
define([], function() {
return %s;
});""" % json.dumps(LANGUAGES)

if __name__ == "__main__":
	main()