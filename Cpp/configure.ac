#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.67])
AC_INIT(libxulsword, 1.6.2, gpl.programs.info@gmail.com)
AC_CONFIG_SRCDIR([canon_synodalprot.h])
AC_CONFIG_HEADERS([config.h])

AM_INIT_AUTOMAKE
AC_CONFIG_MACRO_DIR([m4])

# Checks for programs.
AC_PROG_LIBTOOL
AC_PROG_CXX
AC_PROG_CC
AC_PROG_MAKE_SET

# Checks for libraries.

# Checks for header files.
AC_CHECK_HEADERS([fcntl.h stdlib.h string.h unistd.h wchar.h])

# Checks for typedefs, structures, and compiler characteristics.
AC_HEADER_STDBOOL
AC_C_INLINE
AC_TYPE_SIZE_T

# Checks for library functions.
AC_FUNC_MALLOC
AC_CHECK_FUNCS([mkdir regcomp strchr strstr])

AC_CONFIG_FILES([Makefile])
AC_OUTPUT
