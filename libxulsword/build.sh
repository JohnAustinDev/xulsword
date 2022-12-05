#!/bin/bash

# Set gyp cross-compilation environment variables:
source ./cross-compile 1

npx node-gyp configure

# Fix an apparent i686-w64-mingw32-ln bug where circular library linking 
# fails to link anything, but the normal --libs flag works fine.
patch -s -p0 < build.patch

npx node-gyp build

