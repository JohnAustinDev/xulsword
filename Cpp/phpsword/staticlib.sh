#!/bin/bash
#cc -shared .libs/phpsword.o .libs/.o -L/usr/lib64 -L/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5/64 -lstdc++ ../sword-svn/lib/.libs/libsword-1.6.2.so ../clucene-core-0.9.21b/src/.libs/libclucene.so.0.0.0 -m64 -Wl,-soname -Wl,phpsword.so -o .libs/phpsword.so
#exit

rm .libs/phpswordstatic.so

cc -shared -pthread .libs/phpsword.o .libs/.o \
-L/usr/lib64 -L/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5/64 \
-lstdc++ \
../clucene-core-0.9.21b/src/*.o \
../sword-svn/lib/*.o \
--unresolved-symbols=report-all \
-Wl,-soname -Wl,phpswordstatic.so -o .libs/phpswordstatic.so

exit

cc -shared \
-m64 \
.libs/phpsword.o \
.libs/.o \
../clucene-core-0.9.21b/src/*.o \
../sword-svn/lib/*.o \
-static \
-pthread  \
-L/usr/lib64 \
-L/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5/64 \
/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5/64/libstdc++.a \
/usr/lib/i386-linux-gnu/libz.a \
/usr/lib/i386-linux-gnu/libm.a \
--unresolved-symbols=report-all \
-Wl,-soname -Wl,phpswordstatic.so -o .libs/phpswordstatic.so

#cp .libs/phpswordstatic.so /usr/lib/php5/20090626+lfs/phpsword.so
