PHP_ARG_ENABLE(phpsword,
    [Whether to enable the "phpsword" extension],
    [  --enable-phpsword      Enable "phpsword" extension support])

if test $PHP_PHPSWORD != "no"; then
    AC_DEFINE([PHPSWORD], [1], [Compiling phpsword])
    PHP_REQUIRE_CXX()
    PHP_SUBST(PHPSWORD_SHARED_LIBADD)

    PHP_ADD_INCLUDE(../src/include)
    PHP_ADD_INCLUDE(../install/usr/local/include)
    PHP_ADD_INCLUDE(../sword/include)
    PHP_ADD_INCLUDE(../sword/include/internal/regex)
    
    PHP_ADD_LIBPATH(../install/usr/local/lib)
    PHP_ADD_LIBRARY(stdc++, 1, PHPSWORD_SHARED_LIBADD)
    PHP_ADD_LIBRARY(sword, 1, PHPSWORD_STATIC_LIBADD)
    PHP_ADD_LIBRARY(clucene-core-static, 1, PHPSWORD_STATIC_LIBADD)
    
    PHP_NEW_EXTENSION(phpsword, phpsword.cpp ../src/xulsword.cpp, $ext_shared)
fi
