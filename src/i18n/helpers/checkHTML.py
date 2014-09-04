#!/usr/bin/python
#
# Helper script to make Angular templates parse as jinja templates for translation.
#
# (c)2014 struktur AG

import re
import sys
import os
import fnmatch
from jinja2 import Environment, FileSystemLoader, exceptions

def main(templates, output_folder=None):

	files = []
	for root, dirnames, filenames in os.walk(templates):
		for filename in fnmatch.filter(filenames, '*.html'):
			files.append(os.path.join(root, filename))

	env = Environment(extensions=['jinja2.ext.i18n'])

	for fn in files:

		fp = file(fn, "rb")
		html = fp.read()
		fp.close()

		html = unicode(html, "UTF-8")
		html = re.sub(r"\|(\w|:|\"|\')+", "", html)

		if output_folder:
			tf = os.path.join(output_folder, os.path.split(fn)[1])
			fp = file(tf, "wb")
			fp.write(html.encode("UTF-8"))
			fp.close()

		try:
			t = env.from_string(html)
		except exceptions.TemplateSyntaxError, exc:
			print >>sys.stderr, "Failed to parse: %s at line %d" % (fn, exc.lineno)
			raise

	return 0

if __name__ == "__main__":
	args = sys.argv[1:]
	if not args:
		print "Usage: %s templates-folder [output-folder]" % sys.argv[0]
		sys.exit(1)

	try:
		status = main(*args)
	except Exception, exc:
		print >> sys.stderr, exc
		status = 6

	sys.exit(status)
