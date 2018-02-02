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
    
    # /usr is before ../install in case sword and clucene are installed at /usr
    PHP_ADD_LIBPATH(/usr/local/lib)
    PHP_ADD_LIBPATH(../install/usr/local/lib)
    
    PHP_ADD_LIBRARY(stdc++, 1, PHPSWORD_SHARED_LIBADD)
    
# Don't even try to get phpize to link these libraries statically. After Googling and trying
# reasonable things, phpize and configure never produced the necessary linker flags. So the
# script staticlib.sh can be used for static linking instead.
    PHP_ADD_LIBRARY(sword, 1, PHPSWORD_SHARED_LIBADD)
    PHP_ADD_LIBRARY(clucene-core, 1, PHPSWORD_SHARED_LIBADD)
    PHP_ADD_LIBRARY(clucene-shared, 1, PHPSWORD_SHARED_LIBADD)
    
    PHP_NEW_EXTENSION(phpsword, phpsword.cpp ../src/xulsword.cpp, $ext_shared)
fi
