#!/bin/bash

rm .libs/phpswordstatic.so

cc -shared \
-pthread  \
.libs/phpsword.o \
.libs/.o \
../clucene-core-0.9.21b/src/*.o \
../sword-svn/lib/*.o \
-static \
/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5/libstdc++.a \
/usr/lib/i386-linux-gnu/libz.a \
/usr/lib/i386-linux-gnu/libm.a \
--unresolved-symbols=report-all \
-Wl,-soname -Wl,phpswordstatic.so -o .libs/phpswordstatic.so

cp .libs/phpswordstatic.so /usr/lib/php5/20090626+lfs/phpsword.so
