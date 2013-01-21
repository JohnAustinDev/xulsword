#!/bin/bash

# Static lib requires that sword-svn and clucene are 
# compiled locally to provide necessary object files

security=.libs/security.o 
#security=

if [ `uname -m` == "x86_64" ]
then
echo compiling for 64 bit kernal with gcc 4.6
g++ -shared \
.libs/libxulsword.o \
.libs/xulsword.o $security \
-pthread  \
clucene-core-0.9.21b/src/.libs/*.o \
sword-svn/lib/.libs/*.o \
-lz \
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
-lz \
-L/usr/lib \
-L/usr/lib/gcc/i386-linux-gnu/4.6 \
-lstdc++ \
-lm \
-lc \
-lgcc_s \
-Wl,--no-undefined \
-o .libs/libxulswordstatic.so

fi


