ACLOCAL_AMFLAGS = -I m4
AM_CPPFLAGS = -I$(top_srcdir)/clucene-core-0.9.21b/src -I$(top_srcdir)/sword-svn/include -I$(top_srcdir)/sword-svn/include/internal/regex

if NOSECURITY
AM_CPPFLAGS += -DNOSECURITY
endif

#LDADD = --no-undefined
#LDADD += $(top_builddir)/sword-svn/lib/libsword.la
#LDADD += $(top_builddir)/clucene-core-0.9.21b/src/libclucene.la

#SUBDIRS = sword-svn . clucene-core-0.9.21b

lib_LTLIBRARIES = libxulsword.la
libxulsword_la_LDFLAGS = -Wl,--no-undefined -lsword -lcurl -licudata -licui18n -licuio -licule -liculx -licutest -licutu -licuuc
libxulsword_la_SOURCES = $(top_srcdir)/xulsword.cpp
if !NOSECURITY
libxulsword_la_SOURCES += $(top_srcdir)/security.cpp
endif

dist_doc_DATA = README

#/home/dale/xulsword/mk-dev/Cpp/config.h.in
#/home/dale/xulsword/mk-dev/Cpp/aclocal.m4
#/home/dale/xulsword/mk-dev/Cpp/Makefile.in
#/home/dale/xulsword/mk-dev/Cpp/config.sub
#/home/dale/xulsword/mk-dev/Cpp/config.guess
#/home/dale/xulsword/mk-dev/Cpp/configure
#/home/dale/xulsword/mk-dev/Cpp/depcomp
#/home/dale/xulsword/mk-dev/Cpp/install-sh
#/home/dale/xulsword/mk-dev/Cpp/ltmain.sh
#/home/dale/xulsword/mk-dev/Cpp/missing
