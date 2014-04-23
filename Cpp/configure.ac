# ---------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------

# Version change: Change line 8 only !
# Change it immediately after a release

AC_INIT(libxulsword, 1.7.3, gpl.programs.info@gmail.com)
AC_CONFIG_SRCDIR([autogen.sh])
AC_PREREQ(2.52)
AC_REVISION($Revision: 1.45 $)

AC_CANONICAL_TARGET
AM_INIT_AUTOMAKE

AC_CONFIG_HEADERS([config.h])

AC_CONFIG_MACRO_DIR([m4])

case $host_os in
     mingw*)
	   # both lines necessary to convince gcc to build dll
	   LIBS="$LIBS -no-undefined";
	   export lt_cv_deplibs_check_method=pass_all;
	   ;;
esac

AC_HEADER_STDBOOL
AC_C_INLINE
AC_TYPE_SIZE_T
AC_FUNC_MALLOC
AC_CHECK_FUNCS([mkdir regcomp strchr strstr])

# ---------------------------------------------------------------------
# Check Programs
# ---------------------------------------------------------------------
CFLAGS=" $CFLAGS"
CXXFLAGS=" $CXXFLAGS"
AC_LANG(C++)
AC_PROG_CC
AC_PROG_CXX
AC_PROG_INSTALL
AC_LIBTOOL_WIN32_DLL
AC_PROG_LIBTOOL

AC_C_BIGENDIAN

PKG_CHECK_MODULES([CLUCENE2], [libclucene-core >= 2.3],,true)
if test "x$CLUCENE2_LIBS" = x; then
ACX_CLUCENE
fi

# ---------------------------------------------------------------------
# With options
# ---------------------------------------------------------------------
AC_ARG_WITH(zlib,
	AC_HELP_STRING([--with-zlib],[allow zlib compressed modules (default=yes)]),,with_zlib=yes)
AC_ARG_WITH(icu,
	AC_HELP_STRING([--with-icu],[use ICU for unicode (default=no)]),,with_icu=no)
AC_ARG_WITH(icusword,
	AC_HELP_STRING([--with-icusword],[use custom SWORD ICU (default=no)]),,with_icusword=no)
AC_ARG_WITH(conf,
	AC_HELP_STRING([--with-conf],[install a new sword.conf (default=no)]),,with_conf=no)
AC_ARG_WITH(curl,
	AC_HELP_STRING([--with-curl],[build install manager support using libcurl (default=no)]),,with_curl=no)
#AC_ARG_WITH(lucene,
#	AC_HELP_STRING([--with-lucene],[include lucene support for searching (default=no)]),,with_lucene=no)
AC_ARG_WITH([internalregex],
	AS_HELP_STRING([--with-internalregex], [Compile using SWORDs internal copy of regex]))


# ---------------------------------------------------------------------
# Enable options
# ---------------------------------------------------------------------
AC_ARG_ENABLE(security,
  AC_HELP_STRING([--enable-security],[enable text security (default=no)]),,[nosecurity=yes])
AC_ARG_ENABLE(debug,
	AC_HELP_STRING([--enable-debug],[build debug library (default=no)]),,enable_debug=no)
AC_ARG_ENABLE(warnings,
	AC_HELP_STRING([--enable-warnings],[build with compiler warnings as errors (default=no)]),,enable_warnings=no)
AC_ARG_ENABLE(profile,
	AC_HELP_STRING([--enable-profile],[allow profiling (default=no)]),,enable_profile=no)
AC_ARG_ENABLE(profilefn,
	AC_HELP_STRING([--enable-profilefn],[allow functioncheck profiling (default=no)]),,enable_profilefn=no)
AM_MAINTAINER_MODE

# ---------------------------------------------------------------------
# Debug and profile
# ---------------------------------------------------------------------

# these are first because the SET AM_C.*FLAGS, not just append
if test x$enable_debug = xyes; then
  GCJFLAGS="-g -O0"
  if test x$ac_cv_prog_cc_g = xyes; then
    AM_CFLAGS="-g3 -O0 -Wall -Werror"
  else
    AM_CFLAGS="-O0 -Wall -Werror"
  fi
  if test x$ac_cv_prog_cxx_g = xyes; then
    AM_CXXFLAGS="-g3 -O0 -Wall -Werror"
  else
    AM_CXXFLAGS="-O0 -Wall -Werror"
  fi
else
  AM_CFLAGS="-O3"
  AM_CXXFLAGS="-O3"
fi

# ---------------------------------------------------------------------
# Check libraries
# ---------------------------------------------------------------------
if test x$with_zlib  = xyes; then
	AC_CHECK_LIB(z, compress,,with_zlib="no")
else
	with_zlib="no"
fi

if test x$with_zlib = xno; then
	AM_CFLAGS="$AM_CFLAGS -DEXCLUDEZLIB"
	AM_CXXFLAGS="$AM_CXXFLAGS -DEXCLUDEZLIB"
fi

AS_IF([test "x$with_internalregex" = "xyes"],
      [have_systemregex="no"],
      [AC_SEARCH_LIBS(regexec, regex, [have_systemregex="yes"], [have_systemregex="no"])])

AS_IF([test "x$have_systemregex" = "xyes"],
      [with_internalregex="no"
       AC_MSG_NOTICE([Using system regex.h])],
      [with_internalregex="yes"
       AS_IF([test "x$with_internalregex" = "xno"],
      	[AC_MSG_ERROR([System regex forced but not found])],
	[AC_MSG_NOTICE([Using internal regex.h])])])
 

# ---------------------------------------------------------------------
# Find CppUnit
# ---------------------------------------------------------------------
# Locate CppUnit (minimum version 1.8.0) for testing.  
AM_PATH_CPPUNIT(1.8.0)

# You can set up an automake conditional and use it to conditionally
# build cppunit-using test programs.
AM_CONDITIONAL(HAVE_CPPUNIT, test "$CPPUNIT_LIBS")


# ---------------------------------------------------------------------
# Find pkg-config
# ---------------------------------------------------------------------
use_pkgconfig=yes
AC_PATH_PROG(PKG_CONFIG, pkg-config, no)
if test x$PKG_CONFIG = xno ; then
  AC_MSG_WARN([*** pkg-config not found. See http://www.freedesktop.org/software/pkgconfig/])
  AC_MSG_WARN([not using pkg-config])
  use_pkgconfig=no
fi

if $PKG_CONFIG --atleast-pkgconfig-version 0.14 ; then
  :
else
  AC_MSG_WARN([*** pkg-config too old; version 0.14 or better required.])
  AC_MSG_WARN([not using pkg-config])
  use_pkgconfig=no
fi


# ---------------------------------------------------------------------
# Find ICU tools
# ---------------------------------------------------------------------
ICU_VER=
ICU_LIBS=
ICU_IOLIBS=
if test x$with_icu = xyes; then
	AC_PATH_PROG([PKGDATA], [pkgdata],[/usr/bin/pkgdata],[$PATH:/usr/sbin:.])
	AC_PATH_PROG([GENCCODE], [genccode], [/usr/bin/genccode], [$PATH:/usr/sbin:.])
	AC_PATH_PROG([GENCMN], [gencmn], [/usr/bin/gencmn], [$PATH:/usr/sbin:.])
	AC_PATH_PROG([GENRB], [genrb], [/usr/bin/genrb], [$PATH:/usr/sbin:.])
	
	AC_PATH_PROG(ICU_CONFIG, icu-config, no)
# The icu-config script was new in icu 2.2
	if test "$ICU_CONFIG" = "no" ; then
	   echo "*** The icu-config script installed by icu could not be found"
	   echo "*** continuing anyway and assuming 2.1 or earlier"
	   ICU_VER="2.1"
	   ICU_LIBS="-licui18n -licuuc -licudata"
	   ICU_IOLIBS="-lustdio"
	else
	   ICU_VER=`$ICU_CONFIG --version`
	   ICU_LIBS=`$ICU_CONFIG --ldflags`
	   #ICU_IOLIBS=`if test $(echo "$ICU_VER >= 3.0"|bc) -eq 1; then $ICU_CONFIG --ldflags-icuio; else $ICU_CONFIG --ldflags-ustdio; fi;`
	   ICU_IOLIBS=`$ICU_CONFIG --ldflags-icuio`
	fi
     AM_CXXFLAGS="$AM_CXXFLAGS -D_ICU_"
     AM_CFLAGS="$AM_CFLAGS -D_ICU_"
fi

if test "x$ICU_LIBS" != x; then
	with_icu=yes
	LIBS="$LIBS $ICU_LIBS $ICU_IOLIBS"
else
	with_icu=no
fi


if test x$with_icusword = xyes; then
AM_CXXFLAGS="$AM_CXXFLAGS -D_ICUSWORD_"
AM_CFLAGS="$AM_CFLAGS -D_ICUSWORD_"
fi


AM_CXXFLAGS="$AM_CXXFLAGS -ftemplate-depth-25"

if test x$enable_warnings = xyes; then
  AM_CFLAGS="$AM_CFLAGS -Werror"
  AM_CXXFLAGS="$AM_CXXFLAGS -Werror"
fi

if test x$enable_profile = xyes; then
  AM_CFLAGS="$AM_CFLAGS -pg"
  AM_CXXFLAGS="$AM_CXXFLAGS -pg"
fi
if test x$enable_profilefn = xyes; then
  AM_CFLAGS="$AM_CFLAGS -g -finstrument-functions"
  AM_CXXFLAGS="$AM_CXXFLAGS -g -finstrument-functions"
  LIBS="$LIBS -g -finstrument-functions -lfnccheck"
fi

# ---------------------------------------------------------------------
# Check for curl for installmgr suport
# ---------------------------------------------------------------------

with_internalftplib=no
if test x$with_curl = xyes; then
    AC_PATH_PROG(CURL_CONFIG, curl-config, no)
    if test "$CURL_CONFIG" = "no" ; then
	echo "*** The curl-config script installed by curl could not be found"
	echo "*** compiling without libcurl support"
	with_curl=no
	with_internalftplib=yes
    else
	echo "curl found - remote install options available"
	CURL_AM_CFLAGS=`$CURL_CONFIG --cflags`
	CURL_LIBS=`$CURL_CONFIG --libs`
	AM_CXXFLAGS="$AM_CXXFLAGS -DCURLAVAILABLE $CURL_AM_CFLAGS"
	AM_CFLAGS="$AM_CFLAGS -DCURLAVAILABLE $CURL_AM_CFLAGS"
	LIBS="$LIBS $CURL_LIBS"
    fi
else
	with_curl=no;
	with_internalftplib=yes
fi

# ---------------------------------------------------------------------
# Check for clucene for lucene searching support
# ---------------------------------------------------------------------

# NOTE the $libdir hack at the end of the c[xx]flags.  Apparently F16 finds that clucene is not multilib-save and places some include files in /usr/lib[64]/
with_clucene=no
if test "x$CLUCENE2_LIBS" != x; then
   echo "clucene 2.x found - lucene searching options available"
   AM_CXXFLAGS="$AM_CXXFLAGS $CLUCENE2_CFLAGS -DUSELUCENE -DCLUCENE2 -I$libdir"
   AM_CFLAGS="$AM_CFLAGS $CLUCENE2_CFLAGS -DUSELUCENE -DCLUCENE2 -I$libdir"
   LIBS="$LIBS $CLUCENE2_LIBS"
   with_clucene="yes 2.x"
else
if test "x$CLUCENE_LIBS" != x; then
   echo "lucene 0.x found - lucene searching options available"
   AM_CXXFLAGS="$AM_CXXFLAGS $CLUCENE_CXXFLAGS -DUSELUCENE -I$libdir"
   AM_CFLAGS="$AM_CFLAGS -DUSELUCENE -I$libdir"
   LIBS="$LIBS $CLUCENE_LIBS"
   with_clucene="yes 0.x"
else
   echo "lucene searching options not available"
fi
fi

AC_CHECK_FUNCS(vsnprintf, [have_vsnprintf="yes"])

# ---------------------------------------------------------------------
# Alter global conf directory only if not /etc
# ---------------------------------------------------------------------

if test "x$sysconfdir" = "x/etc"; then
  dir_confdef="no"
else
  dir_confdef="yes"
fi


# ---------------------------------------------------------------------
# Substitute variables into makefiles
# ---------------------------------------------------------------------
AC_SUBST(with_zlib)
AC_SUBST(with_icu)
AC_SUBST(with_icusword)
AC_SUBST(with_conf)
AC_SUBST(dir_confdef)
AC_SUBST(CC)
AC_SUBST(ICU_VER)
AC_SUBST(enable_debug)
AC_SUBST(enable_profile)

# TODO: WHY ARE WE SUBST CXXFLAGS BUT NOT CFLAGS?  And why, when I uncomment out the cflags subst do we get compile errors?
AC_SUBST(AM_CXXFLAGS)
#AC_SUBST(AM_CFLAGS)

AC_SUBST(target_cpu)
AC_SUBST(target_vendor)
AC_SUBST(target_os)

AC_SUBST(target_system)
AC_SUBST(target_mingw32)

AC_SUBST(CURL_LIBS)
AC_SUBST(ICU_LIBS)
AC_SUBST(ICU_IOLIBS)


# ---------------------------------------------------------------------
# Conditional variables
# ---------------------------------------------------------------------

# don't #ifdef in .cpp files HAVE_ stuff because non-ac compiles won't be able to switch them since we include config.h
AM_CONDITIONAL(HAVE_LIBZ, test x$with_zlib = xyes)
AM_CONDITIONAL(HAVE_ICU, test x$with_icu = xyes)
AM_CONDITIONAL(HAVE_ICUSWORD, test x$with_icusword = xyes)
AM_CONDITIONAL(HAVE_VSNPRINTF, test x$have_vsnprintf = xyes)

AM_CONDITIONAL(NOSECURITY, test "x$nosecurity" = xyes)
AM_CONDITIONAL(USELUCENE, test "x$with_clucene" != xno)
AM_CONDITIONAL(SHAREDLIB, test x$enable_shared = xyes)
AM_CONDITIONAL(INSTCONF, test x$with_conf = xyes)
AM_CONDITIONAL(WITHCURL, test x$with_curl = xyes)
AM_CONDITIONAL(INTERNALFTPLIB, test x$with_internalftplib = xyes)
AM_CONDITIONAL(USE_INTERNAL_REGEX, test x$with_internalregex = xyes)
AM_CONDITIONAL(CONFDEF, test x$dir_confdef = xyes)
AM_CONDITIONAL(USE_PKGCONF, test x$use_pkgconfig = xyes)
AM_CONDITIONAL(BUILDTESTS, test x$enable_tests = xyes)
AM_CONDITIONAL(BUILDUTILS, test x$enable_utilities = xyes)
AM_CONDITIONAL(BUILDEXAMPLES, test x$enable_examples = xyes)

# ---------------------------------------------------------------------
# Final output
# ---------------------------------------------------------------------
AC_CONFIG_FILES(Makefile)
AC_OUTPUT

echo
echo
echo "Configuration:"
echo     "     NOSECURITY:       $nosecurity"
echo     "     LIBDIR:           $libdir"
echo     "     DEBUG:            $enable_debug"
echo     "     PROFILE:          $enable_profile"
echo     "     BUILD TESTS:      $enable_tests"
echo     "     BUILD EXAMPLES:   $enable_examples"
echo     "     BUILD UTILITIES:  $enable_utilities"
echo     "     LIBZ:             $with_zlib"
echo     "     ICU:              $with_icu"
echo     "     ICUSWORD:         $with_icusword"
echo     "     CURL:             $with_curl"
echo     "     INTERNAL FTPLIB:  $with_internalftplib"
echo     "     INTERNAL REGEX:   $with_internalregex"
echo     "     CLUCENE:          $with_clucene"
echo
echo




