#!/bin/bash

# Static lib requires that sword-svn and clucene are 
# compiled locally to provide necessary object files

#security=.libs/security.o 
security=

#icu=-licui18n\ -licudata\ -licuuc
icu=
lzma=
bz2=

if [ $(uname | grep Darwin) ]; then
g++ -dynamiclib -Wl,-undefined -Wl,dynamic_lookup \
-o .libs/libxulswordstatic.dylib \
.libs/xulsword.o \
.libs/libxulsword.o  \
clucene-core-0.9.21b/src/.libs/*.o \
sword-svn/lib/.libs/*.o \
-L/usr/local/lib \
-lcurl \
-lz -O3 \
-install_name /usr/local/lib/libxulsword.0.dylib \
-compatibility_version 1 -current_version 1.0 -Wl,-single_module

elif [ `uname -m` == "x86_64" ]; then
echo compiling for 64 bit kernal with gcc 4.6
g++ -shared \
.libs/libxulsword.o \
.libs/xulsword.o $security \
-pthread  \
clucene-core-0.9.21b/src/.libs/*.o \
sword-svn/lib/.libs/*.o \
$lzma $bz2 $icu -lz \
-L/usr/lib \
-L/usr/lib/gcc/x86_64-linux-gnu/4.6 \
-lstdc++ \
-lm \
-lc \
-lgcc_s \
-Wl,--no-undefined \
-o .libs/libxulswordstatic.so

else
echo compiling for 32 bit kernal with gcc 4.6
g++ -shared \
.libs/libxulsword.o \
.libs/xulsword.o $security \
-pthread  \
clucene-core-0.9.21b/src/.libs/*.o \
sword-svn/lib/.libs/*.o \
$lzma $bz2 $icu -lz \
-L/usr/lib \
-L/usr/lib/gcc/i386-linux-gnu/4.6 \
-lstdc++ \
-lm \
-lc \
-lgcc_s \
-Wl,--no-undefined \
-o .libs/libxulswordstatic.so

fi


