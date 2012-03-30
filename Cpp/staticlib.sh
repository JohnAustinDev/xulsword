#!/bin/bash

g++ -shared \
.libs/xulsword.o \
-pthread  \
clucene-core-0.9.21b/src/*.o \
sword-svn/lib/*.o \
-lz \
-L/usr/lib \
-L/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5.2 \
-L/usr/lib/i386-linux-gnu/gcc/i686-linux-gnu/4.5.2/../../.. \
-L/usr/lib/i386-linux-gnu -lstdc++ \
-lm \
-lc \
-lgcc_s \
-Wl,--no-undefined \
-o .libs/libxulswordstatic.so

