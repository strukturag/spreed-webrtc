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

I18N_VERSION="1.0"
I18N_PROJECT="Spreed WebRTC"
I18N_COPYRIGHT="struktur AG"
I18N_BUG_ADDRESS="simon@struktur.de"
AC_SUBST(I18N_VERSION)
AC_SUBST(I18N_PROJECT)
AC_SUBST(I18N_COPYRIGHT)
AC_SUBST(I18N_BUG_ADDRESS)

# minimum required versions
GO_VERSION_MIN=1.4
NODEJS_VERSION_MIN=0.6.0
NODEJS_VERSION_STYLES_MIN=0.10.0
SASS_VERSION_MIN=3.3.0
SCSS_LINT_VERSION_MIN=0.33.0
PO2JSON_VERSION_MIN=0.4.1

AC_CONFIG_SRCDIR([src/app/spreed-webrtc-server/main.go])
AC_CONFIG_MACRO_DIR([m4])

dnl required version of automake
AM_INIT_AUTOMAKE([1.10])

dnl enable mainainer mode by default
AM_MAINTAINER_MODE([enable])

AC_PROG_MKDIR_P
AC_PROG_INSTALL
AC_PROG_GREP
AC_PROG_SED
AC_PROG_AWK

AC_PATH_PROGS([FIND],[find])

AC_PATH_PROGS([GPM],[gpm])
if test x"${GPM}" != x"" ; then
    AC_MSG_CHECKING([for version of gpm])
    GPM_VERSION=`$GPM version 2>&1 | $SED 's/^>> gpm v//'`
    AC_MSG_RESULT([$GPM_VERSION])
fi

AC_PATH_PROG([JSHINT],jshint, [], [$PWD/node_modules/.bin$PATH_SEPARATOR$PATH])
if test x"${JSHINT}" != x"" ; then
    AC_MSG_CHECKING([for version of jshint])
    JSHINT_VERSION=`$JSHINT --version 2>&1 | $SED 's/^jshint v//'`
    AC_MSG_RESULT([$JSHINT_VERSION])
fi

AC_PATH_PROGS([PYTHON],[python2 python])
if test x"${PYTHON}" != x"" ; then
    AC_MSG_CHECKING([for version of python2])
    PYTHON_VERSION=`$PYTHON --version 2>&1 | $SED 's/^Python //'`
    AC_MSG_RESULT([$PYTHON_VERSION])
fi

AC_PATH_PROGS([GO],[go])
if test x"${GO}" == x"" ; then
    AC_MSG_ERROR([Please install Go before trying to build spreed-webrtc.])
fi

AC_MSG_CHECKING([for version of Go])
GO_VERSION=`$GO version | $SED 's/^go version go//' | $SED 's/ .*//'`
AC_MSG_RESULT([$GO_VERSION])
AX_COMPARE_VERSION([$GO_VERSION], [lt], [$GO_VERSION_MIN],
    [AC_MSG_ERROR([Please install Go $GO_VERSION_MIN or newer before trying to build spreed-webrtc (found Go $GO_VERSION).])])

AC_ARG_VAR(VENDOR_GOPATH, [Path used to locate third-party Go code, defaults to $PWD/vendor])
AC_MSG_CHECKING([third-party Go source code path])
AM_CONDITIONAL([DEFAULT_VENDOR_GOPATH], [test x"${VENDOR_GOPATH}" == x""])
AM_CONDITIONAL([READONLY_VENDOR_GOPATH], [test -n "${VENDOR_GOPATH}" -a ! -w "${VENDOR_GOPATH}"])
AM_COND_IF(DEFAULT_VENDOR_GOPATH, [AC_SUBST(VENDOR_GOPATH, $PWD/vendor)])
AC_MSG_RESULT([$VENDOR_GOPATH])
AX_COMPARE_VERSION([$GO_VERSION], [lt], [1.5], [GO_14="1"], [GO_14="0"])
AM_CONDITIONAL([GO_14], [test x"${GO_14}" = x"1"])

AC_PATH_PROGS([NODEJS],[nodejs node])
if test x"${NODEJS}" == x"" ; then
    AC_MSG_ERROR([Please install node.js before trying to build spreed-webrtc.])
else
    AC_MSG_CHECKING([for version of node.js])
    NODEJS_VERSION=`$NODEJS --version | $SED 's/^v//'`
    AC_MSG_RESULT([$NODEJS_VERSION])
    AX_COMPARE_VERSION([$NODEJS_VERSION], [lt], [$NODEJS_VERSION_MIN],
        [AC_MSG_ERROR([Please install node.js $NODEJS_VERSION_MIN or newer before trying to build spreed-webrtc (found node.js $NODEJS_VERSION).])])
    AX_COMPARE_VERSION([$NODEJS_VERSION], [lt], [$NODEJS_VERSION_STYLES_MIN],
        [AC_MSG_WARN([Please install node.js $NODEJS_VERSION_STYLES_MIN or newer before trying to build styles (found node.js $NODEJS_VERSION).])
        NODEJS_SUPPORT_STYLES=no],[NODEJS_SUPPORT_STYLES=yes])
fi
AC_SUBST(NODEJS_SUPPORT_STYLES)

AC_PATH_PROGS([COMPASS],[compass])
if test x"${COMPASS}" == x"" ; then
    AC_MSG_WARN([Please install compass before trying to build styles.])
else
    AC_MSG_CHECKING([for version of compass])
    COMPASS_VERSION=`$COMPASS --version | $AWK 'NR==1' | $SED 's/^Compass //' | $SED 's/ .*//'`
    AC_MSG_RESULT([$COMPASS_VERSION])
fi

AC_PATH_PROGS([SASS],[sass])
if test x"${SASS}" == x"" ; then
    AC_MSG_WARN([Please install sass before trying to build styles.])
else
    AC_MSG_CHECKING([for version of sass])
    SASS_VERSION=`$SASS --version | $SED 's/^Sass //' | $SED 's/ .*//'`
    AC_MSG_RESULT([$SASS_VERSION])
    AX_COMPARE_VERSION([$SASS_VERSION], [lt], [$SASS_VERSION_MIN],
        [AC_MSG_WARN([Please install compass with sass $SASS_VERSION_MIN or newer before trying to build styles (found sass $SASS_VERSION).])
        SASS_SUPPORT_STYLES=no],[SASS_SUPPORT_STYLES=yes])
fi

AC_PATH_PROG([SCSS_LINT],scss-lint, [], [$PWD/node_modules/.bin$PATH_SEPARATOR$PATH])
if test x"${SCSS_LINT}" == x"" ; then
    AC_MSG_WARN([Please install scss-lint to lint styles.])
else
    AC_MSG_CHECKING([for version of scss-lint])
    SCSS_LINT_VERSION=`$SCSS_LINT --version | $SED 's/^scss-lint //' | $SED 's/ .*//'`
    AC_MSG_RESULT([$SCSS_LINT_VERSION])
fi

if test x"${SASS}" != x"" ; then
    AC_MSG_CHECKING([for compass support in sass])
    tempfile=`mktemp -t XXXXXXblah`
    cd src/styles
    $SASS --compass $tempfile > /dev/null 2> /dev/null
    sass_compass=$?
    rm $tempfile
    cd ../../
    if test x"${sass_compass}" != x"0" ; then
        AC_MSG_RESULT([not available])
        AC_MSG_WARN([Please install compass so it can be used using "sass --compass ...".])
        SASS_SUPPORT_STYLES=no
    else
        AC_MSG_RESULT([ok])
    fi
fi
AC_SUBST(SASS_SUPPORT_STYLES)

AC_PATH_PROG([AUTOPREFIXER],autoprefixer, [], [$PWD/node_modules/.bin$PATH_SEPARATOR$PATH])
if test x"${AUTOPREFIXER}" == x"" ; then
    AC_MSG_WARN([Please install autoprefixer before trying to build styles.])
else
    AC_MSG_CHECKING([for version of autoprefixer])
    AUTOPREFIXER_VERSION=`$AUTOPREFIXER --version | $SED 's/^autoprefixer //'`
    AC_MSG_RESULT([$AUTOPREFIXER_VERSION])
fi

AC_PATH_PROGS([PYBABEL],[pybabel])
if test x"${PYBABEL}" == x"" ; then
    AC_MSG_WARN([Please install pybabel before trying to build i18n.])
else
    AC_MSG_CHECKING([for version of pybabel])
    PYBABEL_VERSION=`$PYBABEL --version | $SED 's/^pybabel //'`
    AC_MSG_RESULT([$PYBABEL_VERSION])
fi

AC_PATH_PROGS([NPM],[npm])
NODEJS_SUPPORT_PO2JSON=no
if test x"${NPM}" != x"" ; then
    AC_MSG_CHECKING([for version of npm])
    NPM_VERSION=`$NPM --version`
    AC_MSG_RESULT([$NPM_VERSION])
    AC_MSG_CHECKING([for po2json support in node.js])
    found_po2json=`{ $NPM list --global & $NPM list; } 2>/dev/null | $GREP -v 'UNMET DEPENDENCY' | $GREP po2json`
    if test x"${found_po2json}" == x"" ; then
        AC_MSG_RESULT([not available])
        AC_MSG_WARN([Please install the node.js module po2json to build i18n.])
    else
        AC_MSG_RESULT([ok])
        AC_MSG_CHECKING([for version of po2json])
        PO2JSON_VERSION=`{ $NPM list --global & $NPM list; } 2>&1 | $GREP -v 'required' | $GREP po2json@ | tail -n1 | $SED 's/^.*po2json@//'`
        AC_MSG_RESULT([$PO2JSON_VERSION])
        AX_COMPARE_VERSION([$PO2JSON_VERSION], [lt], [$PO2JSON_VERSION_MIN],
            [AC_MSG_WARN([Please install po2json version $PO2JSON_VERSION_MIN or newer before trying to build translations (found po2json $PO2JSON_VERSION).])
            NODEJS_SUPPORT_PO2JSON=no],[NODEJS_SUPPORT_PO2JSON=yes])
    fi
else
    AC_MSG_WARN([Please install npm and the the node.js module po2json to build i18n.])
fi
AC_SUBST(NODEJS_SUPPORT_PO2JSON)

VERSION=`head -n1 $PWD/CHANGELOG.md | $AWK '{print $2}'`
PACKAGE_VERSION="$VERSION"
PACKAGE_STRING="$PACKAGE_NAME $PACKAGE_VERSION"
AC_DEFINE_UNQUOTED(VERSION, ["$VERSION"], [Version number of package])
AC_DEFINE_UNQUOTED(PACKAGE_VERSION, ["$PACKAGE_VERSION"], [Define to the version of this package.])
AC_DEFINE_UNQUOTED(PACKAGE_STRING, ["$PACKAGE_STRING"], [Define to the full name and version of this package.])

AC_CONFIG_FILES([
    Makefile
    src/styles/Makefile
    src/i18n/Makefile
])
AC_OUTPUT
