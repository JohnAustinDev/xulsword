#!/bin/bash

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


