#!/bin/sh

if [ -d ".git/hooks" ]; then
    # the pre-commit hook performs various formatting checks
    if test ! \( -x .git/hooks/pre-commit -a -L .git/hooks/pre-commit \); then \
        rm -f .git/hooks/pre-commit; \
        ln -s ../../src/hooks/pre-commit.hook .git/hooks/pre-commit; \
    fi
fi

if [ -x "`which autoreconf 2>/dev/null`" ] ; then
   exec autoreconf -ivf
fi

LIBTOOLIZE=libtoolize
SYSNAME=`uname`
if [ "x$SYSNAME" = "xDarwin" ] ; then
  LIBTOOLIZE=glibtoolize
fi
aclocal -I m4 && \
	autoheader && \
	$LIBTOOLIZE && \
	autoconf && \
	automake --add-missing --force-missing --copy
