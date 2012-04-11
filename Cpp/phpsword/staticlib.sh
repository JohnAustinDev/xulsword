#!/bin/bash

rm .libs/phpswordstatic.so

cc -shared \
.libs/phpsword.o \
.libs/.o \
-pthread  \
../clucene-core-0.9.21b/src/*.o \
../sword-svn/lib/*.o \
-lstdc++ \
-lz \
-lm \
-Wl,-soname -Wl,phpswordstatic.so -o .libs/phpswordstatic.so

cp .libs/phpswordstatic.so /usr/lib/php5/20090626+lfs/phpsword.so
