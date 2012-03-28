PHP_ARG_ENABLE(phpsword,
    [Whether to enable the "phpsword" extension],
    [  --enable-phpsword      Enable "phpsword" extension support])

if test $PHP_PHPSWORD != "no"; then
    PHP_REQUIRE_CXX()
    PHP_SUBST(PHPSWORD_SHARED_LIBADD)
    PHP_ADD_LIBRARY(stdc++, 1, PHPSWORD_SHARED_LIBADD)
    PHP_NEW_EXTENSION(phpsword, phpsword.cpp xulsword.cpp, $ext_shared)
fi
