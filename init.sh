#!/bin/bash

# This script installs dependencies and builds the libxulsword
# dynamic library and libxulsword native node-module.

if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Exiting..."
   exit 1
fi

EXTRAS=IBTXulsword

# OSX uses a different suffix for dynamic libraries ...
LIB_EXT=$([ $(uname | grep Darwin) ] && echo "dylib" || echo "so")

if [ -e /vagrant ]; then CONTEXT="xsguest"; else CONTEXT="host"; fi
if [ "$CONTEXT" = "xsguest" ]; then XULSWORD="$HOME/src/xulsword"; else XULSWORD="$( cd "$(dirname "$0")" ; pwd -P )"; fi
export CPP="$XULSWORD/Cpp"

# BUILD DEPENDENCIES (Ubuntu Xenial & Bionic)
PKG_DEPS="build-essential git subversion libtool-bin cmake autoconf make pkg-config zip curl"
# for ZLib build
PKG_DEPS="$PKG_DEPS debhelper binutils gcc-multilib dpkg-dev"
# for Clucene build
PKG_DEPS="$PKG_DEPS debhelper libboost-dev"
# for VM build
if [ "$CONTEXT" = "xsguest" ]; then PKG_DEPS="$PKG_DEPS libxshmfence1 libglu1 libnss3-dev libgdk-pixbuf2.0-dev libgtk-3-dev libxss-dev libasound2"; fi

# BUID DEPENDENCIES (for cross compiling libxulsword as a Windows dll)
PKG_DEPS="$PKG_DEPS mingw-w64"

if [ $(dpkg -s $PKG_DEPS 2>&1 | grep "not installed" | wc -m) -ne 0 ]; then
  if [ "$CONTEXT" = "xsguest" ]; then
    sudo apt-get update
    sudo apt-get install -y $PKG_DEPS
  else
    echo First, you need to install missing packages with:
    echo .
    echo sudo apt install ${PKG_DEPS}
    echo .
    echo Then run this script again.
    exit;
  fi
fi

# If this is a guest VM, then copy host code to VM and build
# everything within the VM so as not to modify any host build files.
if [ "$CONTEXT" = "xsguest" ]; then
  if [ -e "$XULSWORD" ]; then rm -rf "$XULSWORD/*"; fi
  if [ ! -e "$XULSWORD" ]; then mkdir -p "$XULSWORD"; fi
  cd /vagrant
  git ls-files | tar -czf "$XULSWORD/archive.tgz" -T -
  cd "$XULSWORD"
  tar -xvzf ./archive.tgz
fi

# Install node.js using nvm so our dev environment can use the latest
# LTS version of node.js. Then install yarn and dependant node modules.
cd "$XULSWORD/xulsword"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install 16.14.0
nvm use 16.14.0
npm i --global yarn

# Create a local Cpp installation directory where compiled libraries will
# be installed for libxulsword linking.
if [ ! -e "$XULSWORD/Cpp/install" ]; then  mkdir "$XULSWORD/Cpp/install"; fi

# COMPILE ZLIB
if [ ! -e "$XULSWORD/Cpp/zlib" ]; then
  if [ ! -e "$XULSWORD/archive/zlib_1.2.8.dfsg.orig.tar.gz" ]; then
    cd "$XULSWORD/archive"
    curl -o zlib_1.2.8.dfsg.orig.tar.gz http://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib_1.2.8.dfsg.orig.tar.gz
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "../archive/zlib_1.2.8.dfsg.orig.tar.gz"
  mv zlib-1.2.8 zlib
  mkdir ./zlib/build
  cp -r zlib zlib.64win
  
  cd ./zlib/build
  cmake -G "Unix Makefiles" -D CMAKE_C_FLAGS="-fPIC" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
  # create a symlink to zconf.h (which was just renamed by cmake) so CLucene will compile
  ln -s ./build/zconf.h ../zconf.h

  # CROSS COMPILE TO WINDOWS 64 bit
  cd "$XULSWORD/Cpp"
  cd ./zlib.64win/build
  cmake -G "Unix Makefiles" -D CMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/cmake-toolchain.64win" ..
  make DESTDIR="$XULSWORD/Cpp/install.64win" install
fi

# CROSS-COMPILE BOOST TO WINDOWS FOR CLUCENE
if [ ! -e "$XULSWORD/Cpp/boost" ]; then
  if [ ! -e "$XULSWORD/archive/boost_1_80_0.tar.gz" ]; then
    cd "$XULSWORD/archive"
    curl -o boost_1_80_0.tar.gz https://boostorg.jfrog.io/artifactory/main/release/1.80.0/source/boost_1_80_0.tar.gz
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "../archive/boost_1_80_0.tar.gz"
  mv boost_1_80_0 boost
  cd boost
  # CROSS COMPILE TO WINDOWS 64 BIT:
  echo "using gcc :  : x86_64-w64-mingw32-g++ ;" > user-config.jam
  ./bootstrap.sh
  ./b2 --user-config=./user-config.jam --prefix=./boost-x64 target-os=windows address-model=64 variant=release install
fi

# COMPILE LIBCLUCENE
if [ ! -e "$XULSWORD/Cpp/clucene" ]; then
  if [ ! -e "$XULSWORD/archive/clucene-core_2.3.3.4.orig.tar.gz" ]; then
    cd "$XULSWORD/archive"
    curl -o clucene-core_2.3.3.4.orig.tar.gz http://archive.ubuntu.com/ubuntu/pool/main/c/clucene-core/clucene-core_2.3.3.4.orig.tar.gz
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "../archive/clucene-core_2.3.3.4.orig.tar.gz"
  mv clucene-core-2.3.3.4 clucene
  mkdir ./clucene/build
  # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
  sed -i 's/!allowLeadingWildcard/!true/g' "$XULSWORD/Cpp/clucene/src/core/CLucene/queryParser/QueryParser.cpp"
  cp -r clucene clucene.64win

  if [ $(uname | grep Darwin) ]; then
    # patch clucene for OSX build (https://stackoverflow.com/questions/28113556/error-while-making-clucene-for-max-os-x-10-10/28175358#28175358)
    pushd "$XULSWORD/Cpp/clucene/src/shared/CLucene"
    patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-LuceneThreads.h.diff
    cd config
    patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-config-repl_tchar.h.diff
    popd
  fi

  cd ./clucene/build
  # -D DISABLE_MULTITHREADING=ON causes compilation to fail
  cmake -G "Unix Makefiles" -D BUILD_STATIC_LIBRARIES=ON -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install" install

  # CROSS COMPILE TO WINDOWS 64 BIT
  cd "$XULSWORD/Cpp"
  patch -s -p0 < "$XULSWORD/Cpp/windows/clucene-src.patch"
  cd ./clucene.64win/build
  cmake -DCMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/cmake-toolchain.64win" -C $XULSWORD/Cpp/cluceneMK/cmake/TryRunResults.cmake -D CMAKE_USE_PTHREADS_INIT=OFF -D BUILD_STATIC_LIBRARIES=ON -D ZLIB_INCLUDE_DIR=$XULSWORD/Cpp/install.64win/usr/local/include -D Boost_INCLUDE_DIR="$XULSWORD/Cpp/boost/boost-x64/include" -D ZLIB_LIBRARY=$XULSWORD/Cpp/install.64win/usr/local/lib/libzlibstatic.a ..
  patch -s -p0 -d "$XULSWORD/Cpp/clucene.64win" < "$XULSWORD/Cpp/windows/clucene-build.patch"
  make DESTDIR="$XULSWORD/Cpp/install.64win" install
fi

# COMPILE LIBSWORD
if [ ! -e "$XULSWORD/Cpp/sword" ]; then
  # svn rev 3563 is sword-1.8.1
  swordRev=3563
  cd "$XULSWORD/Cpp"
  svn checkout -r $swordRev http://crosswire.org/svn/sword/trunk sword
  mkdir ./sword/build
  cp -r sword sword.64win

  # The sword CMakeLists.txt expects this header to be here, so add it
  cd "$XULSWORD/Cpp/install/usr/local/lib"
  mkdir CLucene
  cp "$XULSWORD/Cpp/clucene/build/src/shared/CLucene/clucene-config.h" ./CLucene/clucene-config.h

  cd "$XULSWORD/Cpp/sword/build"
  cmake -G "Unix Makefiles" -D SWORD_NO_ICU="No" -D CLUCENE_LIBRARY_DIR="$XULSWORD/Cpp/install/usr/local/lib" -D CLUCENE_LIBRARY="$XULSWORD/Cpp/install/usr/local/lib/libclucene-core.$LIB_EXT" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install" install

  # CROSS COMPILE TO WINDOWS 64 BIT
  cd "$XULSWORD/Cpp"
  patch -s -p0 < "$XULSWORD/Cpp/windows/libsword-src.patch"
  cd ./sword.64win/build
  cmake -DCMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/cmake-toolchain.64win" -D SWORD_NO_ICU="No" -D CLUCENE_LIBRARY="$XULSWORD/Cpp/install.64win/usr/local/lib/libclucene-core.dll.a" -D ZLIB_LIBRARY="$XULSWORD/Cpp/install.64win/usr/local/lib/libzlib.dll.a" -D CLUCENE_LIBRARY_DIR="$XULSWORD/Cpp/install.64win/usr/local/include" -D CLUCENE_INCLUDE_DIR="$XULSWORD/Cpp/install.64win/usr/local/include" -D ZLIB_INCLUDE_DIR="$XULSWORD/Cpp/install.64win/usr/local/include" -DSWORD_BUILD_UTILS="No" ..
  make DESTDIR="$XULSWORD/Cpp/install.64win" install
fi

# COMPILE LIBXULSWORD
if [ ! -e "$XULSWORD/Cpp/build" ]; then
  cd "$XULSWORD/Cpp"
  if [ $(uname | grep Darwin) ]; then
    # patch untgz MAC compile problem
    perl -p -i -e 's/#ifdef unix/#if defined(unix) || defined(__APPLE__)/g' ./sword/src/utilfuns/zlib/untgz.c
  fi
  
  mkdir build
  cd build
  cmake -G "Unix Makefiles" -D SWORD_NO_ICU="No" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make
  
  # CROSS COMPILE TO WINDOWS 64 BIT
  cd "$XULSWORD/Cpp"
  mkdir build.64win
  cd build.64win
  cmake -G "Unix Makefiles" -DCMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/cmake-toolchain.64win" -D SWORD_NO_ICU="No" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install.64win/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install.64win/usr/local/lib" ..
  make
fi

# Now initialize node.js
cd "$XULSWORD"
yarn
