#!/usr/bin/python

import sys
from jinja2 import Environment, FileSystemLoader

def log(error):
	print error

def main(templates):

	env = Environment(loader=FileSystemLoader(templates), extensions=['jinja2.ext.i18n'])
	env.install_null_translations()

	print env.list_templates()
	print dir(env)

	env.compile_templates("lala", log_function=log)

	#for t in env.list_templates():
	#	template = env.get_template(t)
	#	output = template.render()

	#template = env.get_template('test.html')
	#output_from_parsed_template = template.render(foo='Hello World!')
	#print output_from_parsed_template

	# to save the results
	#with open("my_new_file.html", "wb") as fh:
	#    fh.write(output_from_parsed_template)

if __name__ == "__main__":
	args = sys.argv[1:]
	if not args:
		print "Usage: %s templates-folder" % sys.argv[0]
		sys.exit(1)

	status = 0
	for folder in args:
		main(folder)

	sys.exit(status)