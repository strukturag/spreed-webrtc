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

dnl required version of autoconf
AC_PREREQ([2.53])

AC_INIT([spreed-webrtc],[unknown],[opensource@struktur.de],[],[https://github.com/strukturag/spreed-webrtc])

# minimum required versions
GO_VERSION_MIN=1.1
NODEJS_VERSION_MIN=0.8.0
SASS_VERSION_MIN=3.2.0

AC_CONFIG_SRCDIR([src/app/spreed-webrtc-server/main.go])
AC_CONFIG_HEADERS([config.h])
AC_CONFIG_MACRO_DIR([m4])

dnl required version of automake
AM_INIT_AUTOMAKE([1.10])

dnl enable mainainer mode by default
AM_MAINTAINER_MODE([enable])

AC_PROG_MKDIR_P
AC_PROG_INSTALL
AC_PROG_GREP
AC_PROG_SED

AC_SUBST(MKDIR_P)
AC_SUBST(INSTALL)
AC_SUBST(GREP)
AC_SUBST(SED)

AC_PATH_PROGS([FIND],[find])
AC_PATH_PROGS([JSHINT],[jshint])
AC_PATH_PROGS([JS_BEAUTIFY],[js-beautify])

AC_SUBST(FIND)
AC_SUBST(JSHINT)
AC_SUBST(JS_BEAUTIFY)

AC_PATH_PROGS([GO],[go])
if test x"${GO}" == x"" ; then
    AC_MSG_ERROR([Please install Go before trying to build spreed-webrtc.])
fi
GO_VERSION=`$GO version | sed 's/^go version go//' | $SED 's/ .*//'`
AX_COMPARE_VERSION([$GO_VERSION], [lt], [$GO_VERSION_MIN],
    [AC_MSG_ERROR([Please install Go $GO_VERSION_MIN or newer before trying to build spreed-webrtc (found Go $GO_VERSION).])])
AC_SUBST(GO)

AC_PATH_PROGS([NODEJS],[nodejs node])
if test x"${NODEJS}" == x"" ; then
    AC_MSG_ERROR([Please install node.js before trying to build spreed-webrtc.])
fi
NODEJS_VERSION=`$NODEJS --version | $SED 's/^v//'`
AX_COMPARE_VERSION([$NODEJS_VERSION], [lt], [$NODEJS_VERSION_MIN],
    [AC_MSG_ERROR([Please install node.js $NODEJS_VERSION_MIN or newer before trying to build spreed-webrtc (found node.js $NODEJS_VERSION).])])
AC_SUBST(NODEJS)

AC_PATH_PROGS([SASS],[sass])
if test x"${SASS}" == x"" ; then
    AC_MSG_ERROR([Please install sass before trying to build spreed-webrtc.])
fi
SASS_VERSION=`$SASS --version | $SED 's/^Sass //' | $SED 's/ .*//'`
AX_COMPARE_VERSION([$SASS_VERSION], [lt], [$SASS_VERSION_MIN],
    [AC_MSG_ERROR([Please install sass $SASS_VERSION_MIN or newer before trying to build spreed-webrtc (found sass $SASS_VERSION).])])
AC_SUBST(SASS)

AC_PATH_PROGS([COMPASS],[compass])
if test x"${COMPASS}" == x"" ; then
    AC_MSG_ERROR([Please install compass before trying to build spreed-webrtc.])
fi
AC_SUBST(COMPASS)

AC_MSG_CHECKING([for compass support in sass])
tempfile=`mktemp`
$SASS --compass $tempfile > /dev/null 2> /dev/null
sass_compass=$?
rm $tempfile
if test x"${sass_compass}" != x"0" ; then
    AC_MSG_RESULT([not available])
    AC_MSG_ERROR([Please install compass so it can be used using "sass --compass ...".])
fi
AC_MSG_RESULT([ok])

AC_PATH_PROGS([AUTOPREFIXER],[autoprefixer])
if test x"${AUTOPREFIXER}" == x"" ; then
    AC_MSG_ERROR([Please install autoprefixer before trying to build spreed-webrtc.])
fi
AC_SUBST(AUTOPREFIXER)

VERSION=`dpkg-parsechangelog | sed -n 's/^Version: //p'`
PACKAGE_VERSION="$VERSION"
PACKAGE_STRING="$PACKAGE_NAME $PACKAGE_VERSION"
AC_DEFINE_UNQUOTED(VERSION, ["$VERSION"], [Version number of package])
AC_DEFINE_UNQUOTED(PACKAGE_VERSION, ["$PACKAGE_VERSION"], [Define to the version of this package.])
AC_DEFINE_UNQUOTED(PACKAGE_STRING, ["$PACKAGE_STRING"], [Define to the full name and version of this package.])

AC_CONFIG_FILES([
    Makefile
])
AC_OUTPUT
