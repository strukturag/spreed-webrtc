#!/usr/bin/python
# Simple helper to split files into chunks and generate crc32
# checksums to help with file sharing debugging.

import sys
import zlib

fileChunkSize = 60000

def main(fn):

	print "Splitting %s ..." % fn
	count = 0
	with open(fn, "rb") as f:
		while True:
			chunk = f.read(fileChunkSize)
			count += 1
			print count, zlib.crc32(chunk) & 0xffffffff
			if len(chunk) < fileChunkSize:
				break

if __name__ == "__main__":
	args = sys.argv[1:]
	if not args:
		print "Usage %s: filename" % sys.argv[0]
	main(args[0])