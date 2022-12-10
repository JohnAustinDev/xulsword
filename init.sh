#!/bin/bash

cd $( dirname -- "$0"; )

# This script installs dependencies and builds the libxulsword
# dynamic library and libxulsword native node-module.

if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Exiting..."
   exit 1
fi

if [ -e /vagrant ]; then export CONTEXT="xsguest"; else export CONTEXT="host"; fi
if [ "$CONTEXT" = "xsguest" ]; then export XULSWORD="$HOME/src/xulsword"; else export XULSWORD="$( pwd -P )"; fi
export CPP="$XULSWORD/Cpp"

# If this is a guest VM, then copy host code to VM and build
# everything within the VM so as not to modify any host build files.
if [ "$CONTEXT" = "xsguest" ]; then
  if [ -e "$XULSWORD" ]; then rm -rf "$XULSWORD/*"; fi
  if [ ! -e "$XULSWORD" ]; then mkdir -p "$XULSWORD"; fi
  cd /vagrant
  git ls-files | tar -czf "$XULSWORD/archive.tgz" -T -
  cd "$XULSWORD"
  tar -xvzf "$XULSWORD/archive.tgz"
fi

source ./setenv

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

# Install node.js using nvm so our dev environment can use the latest
# LTS version of node.js. Then install yarn and dependant node modules.
cd "$XULSWORD"
export NVM_DIR="$HOME/.nvm"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install 16.14.0
nvm use 16.14.0
npm i --global yarn

# Create a local Cpp installation directory where compiled libraries will
# be installed for libxulsword linking.
if [ ! -e "$XULSWORD/Cpp/install" ]; then mkdir "$XULSWORD/Cpp/install"; fi
if [ ! -e "$XULSWORD/Cpp/install.$XCWD" ]; then mkdir "$XULSWORD/Cpp/install.$XCWD"; fi
ARCHIVEDIR="$XULSWORD/archive"
if [ "$CONTEXT" = "xsguest" ]; then ARCHIVEDIR="/vagrant/archive"; fi
if [ ! -e "$ARCHIVEDIR" ]; then mkdir "$ARCHIVEDIR"; fi

########################################################################
# COMPILE ZLIB
if [ ! -e "$XULSWORD/Cpp/zlib" ]; then
  if [ ! -e "$ARCHIVEDIR/zlib_1.2.8.dfsg.orig.tar.gz" ]; then
    cd "$ARCHIVEDIR"
    curl -o zlib_1.2.8.dfsg.orig.tar.gz http://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib_1.2.8.dfsg.orig.tar.gz
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "$ARCHIVEDIR/zlib_1.2.8.dfsg.orig.tar.gz"
  mv zlib-1.2.8 zlib
  mkdir "./zlib/build"
  
  cd ./zlib/build
  cmake -G "Unix Makefiles" -D CMAKE_C_FLAGS="-fPIC" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
  # create a symlink to zconf.h (which was just renamed by cmake) so CLucene will compile
  ln -s ./build/zconf.h ../zconf.h
fi
# CROSS COMPILE ZLIB TO WINDOWS
if [ ! -e "$XULSWORD/Cpp/zlib.$XCWD" ]; then
  cd "$XULSWORD/Cpp"
  mkdir "./zlib.$XCWD"
  tar -xf "$ARCHIVEDIR/zlib_1.2.8.dfsg.orig.tar.gz" -C "./zlib.$XCWD" --strip-components 1
  mkdir "./zlib.$XCWD/build"
  
  cd "./zlib.$XCWD/build"
  cmake -G "Unix Makefiles" -D CMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/toolchain.cmake" ..
  make DESTDIR="$XULSWORD/Cpp/install.$XCWD" install
fi

########################################################################
# CROSS-COMPILE BOOST TO WINDOWS FOR CLUCENE
if [ ! -e "$BOOSTDIR" ]; then
  if [ ! -e "$ARCHIVEDIR/boost_1_80_0.tar.gz" ]; then
    echo "Download boost_1_80_0.tar.gz from:"
    echo "    https://www.boost.org/users/download/"
    echo "Place it in this directory: $ARCHIVEDIR"
    echo "Then start this script again (boost does not allow auto-downloads)"
    exit
    #cd "$ARCHIVEDIR"
    #curl -o boost_1_80_0.tar.gz http://boostorg.jfrog.io/artifactory/main/release/1.80.0/source/boost_1_80_0.tar.gz
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "$ARCHIVEDIR/boost_1_80_0.tar.gz"
  mv boost_1_80_0 $BOOSTDIR
  cd $BOOSTDIR
  # CROSS COMPILE TO WINDOWS 64 BIT:
  echo "using gcc :  : ${TOOLCHAIN_PREFIX}-g++ ;" > user-config.jam
  ./bootstrap.sh
  ./b2 --user-config=./user-config.jam --prefix=./$XCWD target-os=windows address-model=$ADDRESS_MODEL variant=release install
fi

########################################################################
# COMPILE LIBCLUCENE
if [ ! -e "$XULSWORD/Cpp/clucene" ]; then
  if [ ! -e "$ARCHIVEDIR/clucene-core_2.3.3.4.orig.tar.gz" ]; then
    cd "$ARCHIVEDIR"
    curl -o clucene-core_2.3.3.4.orig.tar.gz http://archive.ubuntu.com/ubuntu/pool/main/c/clucene-core/clucene-core_2.3.3.4.orig.tar.gz
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "$ARCHIVEDIR/clucene-core_2.3.3.4.orig.tar.gz"
  mv clucene-core-2.3.3.4 clucene
  mkdir ./clucene/build
  # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
  sed -i 's/!allowLeadingWildcard/!true/g' "$XULSWORD/Cpp/clucene/src/core/CLucene/queryParser/QueryParser.cpp"

  #if [ $(uname | grep Darwin) ]; then
  #  # patch clucene for OSX build (https://stackoverflow.com/questions/28113556/error-while-making-clucene-for-max-os-x-10-10/28175358#28175358)
  #  pushd "$XULSWORD/Cpp/clucene/src/shared/CLucene"
  #  patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-LuceneThreads.h.diff
  #  cd config
  #  patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-config-repl_tchar.h.diff
  #  popd
  #fi

  cd ./clucene/build
  # -D DISABLE_MULTITHREADING=ON causes compilation to fail
  cmake -G "Unix Makefiles" -D BUILD_STATIC_LIBRARIES=ON -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
fi
# CROSS COMPILE LIBCLUCENE TO WINDOWS
if [ ! -e "$XULSWORD/Cpp/clucene.$XCWD" ]; then
  cd "$XULSWORD/Cpp"
  mkdir "clucene.$XCWD"
  tar -xf "$ARCHIVEDIR/clucene-core_2.3.3.4.orig.tar.gz" -C "./clucene.$XCWD" --strip-components 1
  mkdir "./clucene.$XCWD/build"
  # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
  sed -i 's/!allowLeadingWildcard/!true/g' "$XULSWORD/Cpp/clucene.$XCWD/src/core/CLucene/queryParser/QueryParser.cpp"
  
  cd "$XULSWORD/Cpp"
  patch -s -p0 -d "$XULSWORD/Cpp/clucene.$XCWD" < "$XULSWORD/Cpp/windows/clucene-src.patch"
  cd "./clucene.$XCWD/build"
  cmake -DCMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/toolchain.cmake" -C "$XULSWORD/Cpp/windows/clucene-TryRunResult-${GCCSTD}.cmake" -D CMAKE_USE_PTHREADS_INIT=OFF -D BUILD_STATIC_LIBRARIES=ON -D ZLIB_INCLUDE_DIR="$XULSWORD/Cpp/install.$XCWD/usr/local/include" -D Boost_INCLUDE_DIR="$BOOSTDIR/$XCWD/include" -D ZLIB_LIBRARY="$XULSWORD/Cpp/install.$XCWD/usr/local/lib/libzlibstatic.a" ..
  patch -s -p0 -d "$XULSWORD/Cpp/clucene.$XCWD" < "$XULSWORD/Cpp/windows/clucene-build.patch"
  make DESTDIR="$XULSWORD/Cpp/install.$XCWD" install
fi

########################################################################
# COMPILE LIBSWORD
if [ ! -e "$XULSWORD/Cpp/sword" ]; then
  if [ ! -e "$ARCHIVEDIR/sword-rev-${swordRev}.tar.gz" ]; then
    cd "$ARCHIVEDIR"
    svn checkout -r $swordRev http://crosswire.org/svn/sword/trunk sword
    find ./sword -type d -name '.svn' -exec rm -rf {} \;
    tar -czvf "sword-rev-${swordRev}.tar.gz" sword
    rm -rf sword
  fi
  cd "$XULSWORD/Cpp"
  tar -xf "$ARCHIVEDIR/sword-rev-${swordRev}.tar.gz"
  mkdir "$XULSWORD/Cpp/sword/build"
  
  # SWORD's CMakeLists.txt requires clucene-config.h be located in a weird directory:
  cp -r "$XULSWORD/Cpp/install/usr/local/include/CLucene" "$XULSWORD/Cpp/install/usr/local/lib"

  cd "$XULSWORD/Cpp/sword/build"
  cmake -D SWORD_NO_ICU="No" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$XULSWORD/Cpp/install/usr/local/lib/libclucene-core.so" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" -DSWORD_BUILD_UTILS="No" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
fi
# CROSS COMPILE LIBSWORD TO WINDOWS
if [ ! -e "$XULSWORD/Cpp/sword.$XCWD" ]; then
  cd "$XULSWORD/Cpp"
  mkdir "sword.$XCWD"
  tar -xf "$ARCHIVEDIR/sword-rev-${swordRev}.tar.gz" -C "./sword.$XCWD" --strip-components 1
  mkdir "./sword.$XCWD/build"
  
  # SWORD's CMakeLists.txt requires clucene-config.h be located in a weird directory:
  cp -r "$XULSWORD/Cpp/install.$XCWD/usr/local/include/CLucene" "$XULSWORD/Cpp/install.$XCWD/usr/local/lib"
  
  cd "$XULSWORD/Cpp"
  patch -s -p0 -d "$XULSWORD/Cpp/sword.$XCWD" < "$XULSWORD/Cpp/windows/libsword-src.patch"
  cd "$XULSWORD/Cpp/sword.$XCWD/build"
  cmake -DCMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/toolchain.cmake" -D SWORD_NO_ICU="No" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$XULSWORD/Cpp/install.$XCWD/usr/local/lib/libclucene-core.dll.a" -D ZLIB_LIBRARY="$XULSWORD/Cpp/install.$XCWD/usr/local/lib/libzlibstatic.a" -D CLUCENE_LIBRARY_DIR="$XULSWORD/Cpp/install.$XCWD/usr/local/include" -D CLUCENE_INCLUDE_DIR="$XULSWORD/Cpp/install.$XCWD/usr/local/include" -D ZLIB_INCLUDE_DIR="$XULSWORD/Cpp/install.$XCWD/usr/local/include" -DSWORD_BUILD_UTILS="No" ..
  make DESTDIR="$XULSWORD/Cpp/install.$XCWD" install
fi

########################################################################
# COMPILE AND INSTALL LIBXULSWORD
if [ ! -e "$XULSWORD/Cpp/build" ]; then
#  if [ $(uname | grep Darwin) ]; then
#    # patch untgz MAC compile problem
#    perl -p -i -e 's/#ifdef unix/#if defined(unix) || defined(__APPLE__)/g' ./sword/src/utilfuns/zlib/untgz.c
#  fi
  
  mkdir "$XULSWORD/Cpp/build"
  cd "$XULSWORD/Cpp/build"
  cmake -D SWORD_NO_ICU="No" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
  
  # Install the DLL and all ming dependencies and strip them
  SODIR="$XULSWORD/Cpp/install/so"
  mkdir "$SODIR"
  cp "$XULSWORD/Cpp/install/usr/local/lib/libxulsword-static.so.1.4.4" "$SODIR/libxulsword-static.so"
  strip "$SODIR/"*
fi
# CROSS COMPILE LIBXULSWORD TO WINDOWS
if [ ! -e "$XULSWORD/Cpp/build.$XCWD" ]; then
  mkdir "$XULSWORD/Cpp/build.$XCWD"
  cd "$XULSWORD/Cpp/build.$XCWD"
  cmake -DCMAKE_TOOLCHAIN_FILE="$XULSWORD/Cpp/windows/toolchain.cmake" -D SWORD_NO_ICU="No" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install.$XCWD/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install.$XCWD/usr/local/lib" ..
  make DESTDIR="$XULSWORD/Cpp/install.$XCWD" install
  
  # Install the DLL and all ming dependencies and strip them
  GCCDLL=libgcc_s_seh-1.dll
  if [[ "$XCWD" == "32win" ]]; then
    GCCDLL=libgcc_s_sjlj-1.dll
  fi
  mkdir "$DLLDIR"
  cp "$XULSWORD/Cpp/install.$XCWD/usr/local/bin/libxulsword-static.dll" "$DLLDIR"
  cp "/usr/lib/gcc/${TOOLCHAIN_PREFIX}/9.3-${GCCSTD}/$GCCDLL" "$DLLDIR"
  cp "/usr/lib/gcc/${TOOLCHAIN_PREFIX}/9.3-${GCCSTD}/libstdc++-6.dll" "$DLLDIR"
  cp "/usr/${TOOLCHAIN_PREFIX}/lib/libwinpthread-1.dll" "$DLLDIR"
  # strip "$DLLDIR/"*
fi

# Now initialize node.js
cd "$XULSWORD"
yarn
