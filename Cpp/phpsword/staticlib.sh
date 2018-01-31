#!/bin/bash

# Phpize and configure would not produce the neccessary linker flags
# for a static link. So this follow-on script does the linking instead.

if [ -e .libs/phpswordstatic.so ]; then rm .libs/phpswordstatic.so; fi

gcclibDir=$(cc -v 2>&1 | grep COLLECT_LTO_WRAPPER | sed -r 's/(^.*?=|[^\/]*$)//g')

# Linker --no-undefined is not used because zend functions are not 
# located until later, however, it should be used to validate that all  
# other references are linked, and then it can be commented out again.
#noundef="-Wl,--no-undefined"

ccflags="-shared -pthread .libs/phpsword.o \
../build/CMakeFiles/xulsword-static.dir/src/xulsword.cpp.o
../install/usr/local/lib/libsword.a
../install/usr/local/lib/libclucene-core-static.a
../install/usr/local/lib/libclucene-shared-static.a
../install/usr/local/lib/libz.a
$noundef -L$gcclibDir -lstdc++ -lm \
-Wl,-soname -Wl,phpswordstatic.so -o .libs/phpswordstatic.so"

echo cc $ccflags
cc $ccflags

if [ -f ".libs/phpsword.so" ]; then mv ./.libs/phpsword.so ./.libs/phpsword-shared.so; fi
if [ -e ".libs/phpswordstatic.so" ]; then ln -s ./phpswordstatic.so ./.libs/phpsword.so; fi
