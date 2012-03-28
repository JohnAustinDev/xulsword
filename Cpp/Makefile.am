ACLOCAL_AMFLAGS = -I m4
AM_CPPFLAGS = -I$(top_srcdir)/clucene-core-0.9.21b/src -I$(top_srcdir)/sword-svn/include -I$(top_srcdir)/sword-svn/include/internal/regex

LDADD = $(top_builddir)/sword-svn/lib/libsword.la
LDADD += $(top_builddir)/clucene-core-0.9.21b/src/libclucene.la

SUBDIRS = sword-svn . clucene-core-0.9.21b

lib_LTLIBRARIES = libxulsword.la
libxulsword_la_SOURCES = $(top_srcdir)/xulsword.cpp
libxulsword_la_SOURCES += $(top_srcdir)/security.cpp

dist_doc_DATA = README
