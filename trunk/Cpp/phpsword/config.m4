PHP_ARG_ENABLE(phpsword,
    [Whether to enable the "phpsword" extension],
    [  --enable-phpsword      Enable "phpsword" extension support])

if test $PHP_PHPSWORD != "no"; then
    PHPSWORD = 1
    PHP_REQUIRE_CXX()
    PHP_SUBST(PHPSWORD_SHARED_LIBADD)
    -I$(top_srcdir)/src/include 
    -I$(top_srcdir)/clucene-core-0.9.21b/src 
    -I$(top_srcdir)/sword-svn/include 
    -I$(top_srcdir)/sword-svn/include/internal/regex

    PHP_ADD_INCLUDE(../src/include)
    PHP_ADD_INCLUDE(../clucene-core-0.9.21b/src)
    PHP_ADD_INCLUDE(../sword-svn/include)
    PHP_ADD_INCLUDE(../sword-svn/include/internal/regex)
    PHP_ADD_LIBRARY(stdc++, 1, PHPSWORD_SHARED_LIBADD)
    PHP_ADD_LIBRARY(sword, 1, PHPSWORD_SHARED_LIBADD)
    PHP_ADD_LIBRARY(clucene, 1, PHPSWORD_SHARED_LIBADD)
    PHP_NEW_EXTENSION(phpsword, phpsword.cpp ../src/xulsword.cpp, $ext_shared)
fi
