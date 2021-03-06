#!/bin/bash

# This script checks the necessary dependencies and builds xulsword

if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Exiting..." 
   exit 1
fi

EXTRAS=IBTXulsword

# OSX uses a different suffix for dynamic libraries ...
LIB_EXT=$([ $(uname | grep Darwin) ] && echo "dylib" || echo "so")

if [ -e /vagrant ]; then CONTEXT="xsguest"; else CONTEXT="host"; fi
if [ -e /vagrant ]; then XULSWORD="$HOME/src/xulsword"; else XULSWORD="$( cd "$(dirname "$0")" ; pwd -P )"; fi

# BUILD DEPENDENCIES (Ubuntu Xenial & Bionic)
PKG_DEPS="build-essential git subversion libtool-bin cmake autoconf make pkg-config zip"
# for ZLib build
PKG_DEPS="$PKG_DEPS debhelper binutils gcc-multilib dpkg-dev"
# for Clucene build
PKG_DEPS="$PKG_DEPS debhelper libboost-dev"
if [ $(dpkg -s $PKG_DEPS 2>&1 | grep "not installed" | wc -m) -ne 0 ]; then
  if [ "$CONTEXT" = "xsguest" ]; then
    sudo apt-get update
    sudo apt-get install -y $PKG_DEPS
  else
    echo
    echo First, you need to install missing packages:
    echo $(dpkg -s $PKG_DEPS 2>&1 | grep "not installed")
    echo .
    echo Then run this script again.
    exit;
  fi
fi

# If this is a xulsword guest, then get host's xulsword code, but build everything within the VM
if [ "$CONTEXT" = "xsguest" ]; then
  #if [ -e "$XULSWORD" ]; then rm -rf "$XULSWORD"; fi
  if [ ! -e "$XULSWORD" ]; then mkdir -p "$XULSWORD"; fi
  cd /vagrant
  git ls-files | tar -czf "$XULSWORD/archive.tgz" -T -
  cd "$XULSWORD"
  tar -xvzf ./archive.tgz
fi

# Create a local installation directory
if [ ! -e "$XULSWORD/Cpp/install" ]; then  mkdir "$XULSWORD/Cpp/install"; fi

# Compile zlib (local compilation is required to create CLucene static library)
# https://packages.ubuntu.com/source/xenial/zlib
if [ ! -e "$XULSWORD/Cpp/zlib" ]; then
  cd "$XULSWORD/Cpp"
  curl -o zlib_1.2.8.dfsg.orig.tar.gz http://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib_1.2.8.dfsg.orig.tar.gz
  tar -xf zlib_1.2.8.dfsg.orig.tar.gz
  rm zlib_1.2.8.dfsg.orig.tar.gz
  mv zlib-1.2.8 zlib
  mkdir ./zlib/build
  cd ./zlib/build
  cmake -G "Unix Makefiles" -D CMAKE_C_FLAGS="-fPIC" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
  # create a symlink to zconf.h (which was just renamed by cmake) so CLucene will compile
  ln -s ./build/zconf.h ../zconf.h
fi

# Compile libclucene (local compilation is required to create libsword static library)
if [ ! -e "$XULSWORD/Cpp/clucene" ]; then
  cd "$XULSWORD/Cpp"
  curl -o clucene-core_2.3.3.4.orig.tar.gz http://archive.ubuntu.com/ubuntu/pool/main/c/clucene-core/clucene-core_2.3.3.4.orig.tar.gz
  tar -xf clucene-core_2.3.3.4.orig.tar.gz
  rm clucene-core_2.3.3.4.orig.tar.gz
  mv clucene-core-2.3.3.4 clucene

  if [ $(uname | grep Darwin) ]; then
    # patch clucene for OSX build (https://stackoverflow.com/questions/28113556/error-while-making-clucene-for-max-os-x-10-10/28175358#28175358)
    pushd "$XULSWORD/Cpp/clucene/src/shared/CLucene"
    patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-LuceneThreads.h.diff
    cd config
    patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-config-repl_tchar.h.diff
    popd
  fi
  
  # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump. 
  sed -i 's/!allowLeadingWildcard/!true/g' "$XULSWORD/Cpp/clucene/src/core/CLucene/queryParser/QueryParser.cpp"

  mkdir ./clucene/build
  cd ./clucene/build
  # -D DISABLE_MULTITHREADING=ON causes compilation to fail
  cmake -G "Unix Makefiles" -D BUILD_STATIC_LIBRARIES=ON -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
fi

# Compile libsword (local compilation is required to create libxulsword static library)
if [ ! -e "$XULSWORD/Cpp/sword" ]; then
  # svn rev 3563 is sword-1.8.1
  swordRev=3563
  cd "$XULSWORD/Cpp"
  svn checkout -r $swordRev http://crosswire.org/svn/sword/trunk sword
  mkdir ./sword/build
  
  # The sword CMakeLists.txt expects this header to be here, so add it
  cd "$XULSWORD/Cpp/install/usr/local/lib"
  mkdir CLucene
  cp "$XULSWORD/Cpp/clucene/build/src/shared/CLucene/clucene-config.h" ./CLucene/clucene-config.h
  
  cd "$XULSWORD/Cpp/sword/build"
  cmake -G "Unix Makefiles" -D SWORD_NO_ICU="No" -D CLUCENE_LIBRARY_DIR="$XULSWORD/Cpp/install/usr/local/lib" -D CLUCENE_LIBRARY="$XULSWORD/Cpp/install/usr/local/lib/libclucene-core.$LIB_EXT" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
fi

# Compile libxulsword
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
fi

# Install xulrunner locally
if [ ! -e "$XULSWORD/xulrunner" ]; then
  xulrunnerRev=41.0b9
  cd "$XULSWORD"
  if [ $(uname | grep Darwin) ]; then
    xulrunner=xulrunner-$xulrunnerRev.en-US.mac.tar.bz2
  else
    xulrunner=xulrunner-$xulrunnerRev.en-US.linux-$(uname -m).tar.bz2
  fi
  curl -o $xulrunner http://ftp.mozilla.org/pub/mozilla.org/xulrunner/releases/$xulrunnerRev/runtimes/$xulrunner
  tar -xf $xulrunner
  rm $xulrunner
fi

if [ "$CONTEXT" = "xsguest" ]; then 
  # On VM: Start with a clean build-out
  rm -rf "$XULSWORD/build-out"
fi

# BUILD XULSWORD
if [ ! -e "$XULSWORD/sword" ]; then mkdir "$XULSWORD/sword"; fi
if [ -e "$XULSWORD/$EXTRAS/loc_MK.txt" ]; then
  "$XULSWORD/$EXTRAS/build_MK.sh"
  cd "$XULSWORD/build"
  "./build.pl" "$XULSWORD/$EXTRAS/loc_MK.txt"
else
  cd "$XULSWORD/build"
  "./build.pl"
fi

if [ "$CONTEXT" = "xsguest" ]; then
  # On VM: Copy build-out result to host
  cp -rf "$XULSWORD/build-out" /vagrant
fi

if [ "$CONTEXT" = "xsguest" ]; then
  # On VM: Start xulsword GUI
  # must also have this installed to run xulsword GUI
  if [[ "$(uname -a)" = *"xenial"* ]]; then 
    sudo apt-get install -y firefox
  else
    sudo apt-get install -y libgtk2.0-dev
  fi
  if [ -e "$XULSWORD/$EXTRAS/loc_MK.txt" ]; then
    "$XULSWORD/build/run_MK-dev.pl"
  else
    "$XULSWORD/build/run_xulsword-dev.pl"
  fi
fi
