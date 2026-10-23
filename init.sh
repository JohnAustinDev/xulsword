#!/bin/bash

export XULSWORD
export CPP
export NVM_DIR
export VAGRANT
export BOOSTDIR

# CMake 4 refuses projects which require a CMake version below 3.5, which
# includes zlib, clucene, sword and libxulsword. Older CMake ignores this.
export CMAKE_POLICY_VERSION_MINIMUM=3.5

# This script installs dependencies and builds the libxulsword
# dynamic library and libxulsword native node-module.

# When run in Vagrant this script should run in Ubuntu 22 because snap
# core22 is currently the latest working snap core (June 2025) .

if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Exiting..."
   exit 1
fi

cd "$( dirname "${BASH_SOURCE[0]}" )" || exit 5

if [[ -e "/vagrant" ]]; then VAGRANT="guest"; else VAGRANT="host"; fi

DEBVERS="$(lsb_release -cs 2>/dev/null)"

DBG=
# DBG='-D CMAKE_BUILD_TYPE=Debug'

# BUILD DEPENDENCIES
PKG_DEPS="build-essential git subversion libtool-bin cmake autoconf make pkg-config zip curl"
# for xulsword
PKG_DEPS="$PKG_DEPS debhelper binutils gcc-multilib dpkg-dev debhelper libboost-dev"
# for ZLib build
PKG_DEPS="$PKG_DEPS debhelper binutils gcc-multilib dpkg-dev"
# for Clucene build
PKG_DEPS="$PKG_DEPS debhelper libboost-dev"
# for VM build
if [[ "$VAGRANT" == "guest" ]]; then
  # Ubuntu 24 (noble) renamed libasound2 to libasound2t64.
  case "$DEBVERS" in
    focal|jammy|bullseye|bookworm) ASOUND=libasound2 ;;
    *) ASOUND=libasound2t64 ;;
  esac
  PKG_DEPS="$PKG_DEPS libxshmfence1 libglu1-mesa libnss3-dev libgdk-pixbuf2.0-dev libgtk-3-dev libxss-dev $ASOUND"
fi

if [ "$(dpkg -l $PKG_DEPS 2>&1 | grep "no packages" | wc -m)" -ne 0 ]; then
  echo "INSTALLING LINUX BUILD DEPENDENCIES"
  if [[ "$VAGRANT" == "guest" ]]; then
    sudo apt-get update
    if ! sudo apt-get install -y $PKG_DEPS; then
      echo "ERROR: Failed to install build dependencies."
      exit 1
    fi
  else
    echo "You need to install missing linux packages with:"
    echo .
    echo "sudo apt-get install ${PKG_DEPS}"
    echo .
    echo "Then run this script again."
    exit;
  fi
fi

# If running in Vagrant, then clone the host code to VM and build
# everything within the VM so as not to contaminate the host's own build
# files. Then copy only the finished output libraries to the host.
# Also git must be used (vs. copied from host) so that line endings will
# be correct on both the host and the guest.
COPY_TO_HOST=
if [[ "$VAGRANT" == "guest" ]]; then
  XULSWORD="$HOME/src/xulsword"
  COPY_TO_HOST=1
  if [ ! -e "$HOME/src" ]; then
    mkdir "$HOME/src";
    cd "$HOME/src" || exit 5
    git clone https://github.com/JohnAustinDev/xulsword
  else
    cd "$XULSWORD" ||exit 5
    git pull
  fi
  if [[ -e "/vagrant/setenv" ]]; then cp "/vagrant/setenv" "$XULSWORD"; fi
else
  XULSWORD=$( pwd )
fi

if [[ ! -e "$XULSWORD/setenv" ]]; then cp "$XULSWORD/scripts/setenv" "$XULSWORD"; fi
echo "XULSWORD IS $XULSWORD"
cd "$XULSWORD" || exit 5
source "./setenv"

# Vagrant is only used to create the Ubuntu 22 libxulsword.so file
if [[ "$VAGRANT" == "guest" ]]; then
  WINMACHINE=no
  MACMACHINE=no
  LIBXULSWORD_ONLY=yes
fi

if [[ "$WINMACHINE" != "no" ]]; then
  if [[ -z "$(which wine)" ]]; then
    echo "INSTALLING WINE AND WINDOWS X-COMPILE BUILD DEPENDENCIES"
    if [[ "$VAGRANT" == "guest" ]]; then
      sudo dpkg --add-architecture i386
      sudo wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key
      sudo wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/jammy/winehq-jammy.sources
      sudo apt-get update
      sudo apt install -y --install-recommends winehq-stable gcc-mingw-w64-i686-posix g++-mingw-w64-i686-posix
    else
      echo "You need to install missing windows32 packages with:"
      echo .
      echo "sudo dpkg --add-architecture i386"
      echo "sudo wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key"
      echo "sudo wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/$DEBVERS/winehq-$DEBVERS.sources"
      echo "sudo apt-get update"
      echo "sudo apt install --install-recommends winehq-stable gcc-mingw-w64-i686-posix g++-mingw-w64-i686-posix"
      echo .
      echo "Then run this script again."
      exit;
    fi
  fi
fi

# BUILD DEPENDENCIES (for cross compiling libxulsword to MacOS)
if [[ "$MACMACHINE" != "no" ]]; then
  MAC_DEPS="clang lld llvm xz-utils"
  if [ "$(dpkg -l $MAC_DEPS 2>&1 | grep "no packages" | wc -m)" -ne 0 ]; then
    echo "You need to install missing MacOS x-compile packages with:"
    echo .
    echo "sudo apt-get install ${MAC_DEPS}"
    echo .
    echo "Then run this script again."
    exit;
  fi
  LLVM_BIN="$(llvm-config --bindir)"
  export LLVM_BIN
fi

CPP="$XULSWORD/Cpp"

if [[ "$LIBXULSWORD_ONLY" == "no" ]]; then
  # Install node.js using nvm so our dev environment can use the latest
  # LTS version of node.js. Then install yarn and dependant node modules.
  NVM_DIR="$HOME/.nvm"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

  corepack enable
  yarn set version stable
  yarn install
fi

# Create a local Cpp installation directory where compiled libraries will
# be installed for libxulsword linking.
if [[ ! -e "$XULSWORD/Cpp/install" ]]; then mkdir "$XULSWORD/Cpp/install"; fi
if [[ "$WINMACHINE" != "no" ]]; then
  if [[ ! -e "$XULSWORD/Cpp/install.$XCWD" ]]; then mkdir "$XULSWORD/Cpp/install.$XCWD"; fi
fi

# Create a local lib directory where libxulsword will be installed
if [ ! -e "$XULSWORD/Cpp/lib" ]; then mkdir "$XULSWORD/Cpp/lib"; fi
if [[ "$WINMACHINE" != "no" ]]; then
  if [[ ! -e "$XULSWORD/Cpp/lib.$XCWD" ]]; then mkdir "$XULSWORD/Cpp/lib.$XCWD"; fi
fi
if [[ "$VAGRANT" == "guest" ]]; then
  if [[ ! -e "$XULSWORD/Cpp/lib-core22" ]]; then mkdir "$XULSWORD/Cpp/lib-core22"; fi
fi

# Create an archive directory to cache source code
ARCHIVEDIR="$XULSWORD/archive"
if [[ ! -e "$ARCHIVEDIR" ]]; then mkdir "$ARCHIVEDIR"; fi
if [[ -e "/vagrant/archive" ]]; then ARCHHOST="/vagrant/archive"; else ARCHHOST=$ARCHIVEDIR; fi

function getSource() {
  echo "Getting source code:"
  echo url="$url"
  echo gzfile="$gzfile"
  echo dirin="$dirin"
  echo dirout="$dirout"
  echo ARCHIVEDIR="$ARCHIVEDIR"
  echo ARCHHOST="$ARCHHOST"
  echo swordRev="$swordRev"

  if [ -e "$XULSWORD/Cpp/$dirout" ]; then
    echo "ERROR: source already exists at $dirout"
    exit 1;
  fi

  if [ ! -e "$ARCHIVEDIR/$gzfile" ]; then
    # If file is already on host, copy it.
    if [ -e "$ARCHHOST/$gzfile" ]; then
      echo "Using archived file: $gzfile"
      cp "$ARCHHOST/$gzfile" "$ARCHIVEDIR/$gzfile"
    # Otherwise if it's sword, use subversion to get the rev needed.
    elif [[ "$url" == "http://crosswire.org/svn/sword/trunk" ]]; then
      cd "$ARCHIVEDIR" || exit 5
      svn checkout -r "$swordRev" "$url" "$dirin"
      rm -rf "$dirin/.svn"
      tar -czvf "$gzfile" "$dirin"
      rm -rf "$dirin"
    # Otherwise if there is no url, we're done.
    elif [ -z "$url" ]; then
      echo "Downloading $gzfile:"
      echo "Place it in the xulsword/archive directory."
      echo "Then start this script again ($gzfile does not allow auto-downloads)"
      exit 1;
    # Download from the url
    else
      cd "$ARCHIVEDIR" || exit 5
      curl -o "$gzfile" "$url"
      if [ -e "/vagrant/archive" ]; then
        cp "$gzfile" "/vagrant/archive"
      fi
    fi
  fi

  if [ -e "$ARCHIVEDIR/$gzfile" ]; then
    cd "$XULSWORD/Cpp" || exit 5
    tar -xf "$ARCHIVEDIR/$gzfile"
    mv "$dirin" "$dirout"
    mkdir "./$dirout/build"
    cd "./$dirout/build" || exit 5
  else
    echo "Archive does not exist: $ARCHIVEDIR/$gzfile"
    exit;
  fi
  # Sleep is required for files to be immediately modifiable in vagrant bookworm.
  sleep 1
  echo "Finished getSource $dirin"
}

########################################################################
# MACOS SDK AND TOOLS
if [[ "$MACMACHINE" != "no" ]]; then
  # The MacOS SDK cannot be downloaded automatically.
  MACSDK="$CPP/$MACOS_SDK"
  if [ ! -e "$MACSDK" ]; then
    if [ ! -e "$ARCHIVEDIR/$MACOS_SDK.tar.xz" ]; then
      echo "The MacOS SDK is needed to cross-compile for MacOS, but this file is missing:"
      echo "$ARCHIVEDIR/$MACOS_SDK.tar.xz"
      echo .
      echo "Make it with one of these osxcross scripts (https://github.com/tpoechtrager/osxcross):"
      echo "- On Linux: download an Xcode .xip from https://developer.apple.com/download/all/"
      echo "  (Xcode 15.4 has MacOSX14.5.sdk) and run: tools/gen_sdk_package_pbzx.sh <xcode>.xip"
      echo "- On a Mac with Xcode or its Command Line Tools: run tools/gen_sdk_package.sh"
      echo .
      echo "Place the .sdk.tar.xz file in the xulsword/archive directory. If its SDK version"
      echo "differs, set MACOS_SDK in setenv to match. Then run this script again."
      exit 1
    fi
    tar -xJf "$ARCHIVEDIR/$MACOS_SDK.tar.xz" -C "$CPP"
    if [ ! -e "$MACSDK/usr/lib/libSystem.tbd" ]; then
      echo "ERROR: $ARCHIVEDIR/$MACOS_SDK.tar.xz did not contain $MACOS_SDK"
      exit 1
    fi
  fi

  # rcodesign signs (and notarizes) the MacOS app from Linux.
  DARWINBIN="$CPP/darwin-bin"
  if [ ! -e "$DARWINBIN" ]; then mkdir "$DARWINBIN"; fi
  if [ ! -e "$DARWINBIN/rcodesign" ]; then
    RCODESIGN_VERSION=0.29.0
    RCODESIGN_ARCH="$(uname -m)"
    if [[ "$RCODESIGN_ARCH" == "x86_64" ]]; then
      RCODESIGN_SHA256=dbe85cedd8ee4217b64e9a0e4c2aef92ab8bcaaa41f20bde99781ff02e600002
    elif [[ "$RCODESIGN_ARCH" == "aarch64" ]]; then
      RCODESIGN_SHA256=4af92c87ddf52f5f2d1258a3b4e56c7dcb8f1b2468df744976c5f139e031961f
    else
      echo "ERROR: rcodesign is not available for $RCODESIGN_ARCH"
      exit 1
    fi
    RCODESIGN="apple-codesign-${RCODESIGN_VERSION}-${RCODESIGN_ARCH}-unknown-linux-musl"
    if [ ! -e "$ARCHIVEDIR/$RCODESIGN.tar.gz" ]; then
      curl -L -o "$ARCHIVEDIR/$RCODESIGN.tar.gz" "https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign/${RCODESIGN_VERSION}/$RCODESIGN.tar.gz"
    fi
    if ! echo "$RCODESIGN_SHA256  $ARCHIVEDIR/$RCODESIGN.tar.gz" | sha256sum -c -; then
      echo "ERROR: $ARCHIVEDIR/$RCODESIGN.tar.gz has the wrong checksum"
      exit 1
    fi
    tar -xzf "$ARCHIVEDIR/$RCODESIGN.tar.gz" -C "$DARWINBIN" --strip-components=1 "$RCODESIGN/rcodesign"
  fi
fi
########################################################################


########################################################################
# COMPILE ZLIB
url="http://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib_1.2.8.dfsg.orig.tar.gz"
gzfile="zlib_1.2.8.dfsg.orig.tar.gz"
dirin="zlib-1.2.8"
dirout="zlib"
if [ ! -e "$CPP/zlib" ]; then
  getSource
  cmake "$DBG" -G "Unix Makefiles" -D CMAKE_C_FLAGS="-fPIC" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
fi
# CROSS COMPILE ZLIB TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  dirout="zlib.$XCWD"
  if [ ! -e "$CPP/zlib.$XCWD" ]; then
    getSource
    cmake "$DBG" -G "Unix Makefiles" -D CMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" ..
    make DESTDIR="$CPP/install.$XCWD" install
  fi
fi
# CROSS COMPILE ZLIB TO MACOS
if [[ "$MACMACHINE" != "no" ]]; then
  for MACARCH in $MACOS_ARCHS; do
    export MACARCH
    dirout="zlib.darwin-$MACARCH"
    if [ ! -e "$CPP/$dirout" ]; then
      getSource
      # zlib 1.2.8 defines fdopen as NULL when TARGET_OS_MAC is defined, which
      # breaks the SDK's stdio.h (fixed in zlib 1.2.12 the same way).
      sed -i 's/defined(MACOS) || defined(TARGET_OS_MAC)/defined(MACOS)/' "$CPP/$dirout/zutil.h"
      cmake "$DBG" -G "Unix Makefiles" -D CMAKE_TOOLCHAIN_FILE="$CPP/darwin/toolchain.cmake" ..
      make DESTDIR="$CPP/install.darwin-$MACARCH" install
    fi
  done
fi
########################################################################


########################################################################
# CROSS-COMPILE BOOST TO WINDOWS FOR CLUCENE
if [[ "$WINMACHINE" != "no" ]]; then
  url=
  gzfile="boost_1_80_0.tar.gz"
  dirin="boost_1_80_0"
  dirout="boost-${TOOLCHAIN_PREFIX}-${XCWD}"
  BOOSTDIR="$CPP/boost-${TOOLCHAIN_PREFIX}-${XCWD}"
  if [ ! -e "$BOOSTDIR" ]; then
    getSource
    # CROSS COMPILE TO WINDOWS 64 BIT:
    cd .. || exit 5
    echo "using gcc :  : ${TOOLCHAIN_PREFIX}-g++ ;" > user-config.jam
    ./bootstrap.sh
    ./b2 --user-config=./user-config.jam --prefix=./$XCWD target-os=windows address-model=$ADDRESS_MODEL variant=release install
  fi
fi
########################################################################


########################################################################
# COMPILE LIBCLUCENE
url="http://archive.ubuntu.com/ubuntu/pool/main/c/clucene-core/clucene-core_2.3.3.4.orig.tar.gz"
gzfile="clucene-core_2.3.3.4.orig.tar.gz"
dirin="clucene-core-2.3.3.4"
dirout="clucene"
if [ ! -e "$CPP/clucene" ]; then
  getSource
   # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
  sed -i 's/!allowLeadingWildcard/!true/g' "$CPP/clucene/src/core/CLucene/queryParser/QueryParser.cpp"
  # -D DISABLE_MULTITHREADING=ON causes compilation to fail
  sed -i '11i #include <ctime>' "$CPP/clucene/src/core/CLucene/document/DateTools.cpp"
  cmake "$DBG" -G "Unix Makefiles" -D BUILD_STATIC_LIBRARIES=ON -D CMAKE_INCLUDE_PATH="$CPP/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$CPP/install/usr/local/lib" ..
  make DESTDIR="$CPP/install" install
fi
# CROSS COMPILE LIBCLUCENE TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  dirout="clucene.$XCWD"
  if [ ! -e "$CPP/clucene.$XCWD" ]; then
    getSource
    # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
    sed -i 's/!allowLeadingWildcard/!true/g' "$CPP/clucene.$XCWD/src/core/CLucene/queryParser/QueryParser.cpp"
    cd "$CPP" || exit 5
    patch -s -p0 -d "$CPP/clucene.$XCWD" < "$CPP/windows/clucene-src.patch"
    cd "$CPP/clucene.$XCWD/build" || exit 5
    cmake "$DBG" -DCMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" -C "$CPP/windows/clucene-TryRunResult-${GCCSTD}.cmake" -D CMAKE_USE_PTHREADS_INIT=OFF -D BUILD_STATIC_LIBRARIES=ON -D ZLIB_INCLUDE_DIR="$CPP/install.$XCWD/usr/local/include" -D Boost_INCLUDE_DIR="$BOOSTDIR/$XCWD/include" -D ZLIB_LIBRARY="$CPP/install.$XCWD/usr/local/lib/libzlibstatic.a" ..
    patch -s -p0 -d "$CPP/clucene.$XCWD" < "$CPP/windows/clucene-build.patch"
    make DESTDIR="$CPP/install.$XCWD" install
  fi
fi
# CROSS COMPILE LIBCLUCENE TO MACOS
if [[ "$MACMACHINE" != "no" ]]; then
  for MACARCH in $MACOS_ARCHS; do
    export MACARCH
    dirout="clucene.darwin-$MACARCH"
    if [ ! -e "$CPP/$dirout" ]; then
      getSource
      MACINST="$CPP/install.darwin-$MACARCH/usr/local"
      # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
      sed -i 's/!allowLeadingWildcard/!true/g' "$CPP/$dirout/src/core/CLucene/queryParser/QueryParser.cpp"
      sed -i '11i #include <ctime>' "$CPP/$dirout/src/core/CLucene/document/DateTools.cpp"
      patch -s -p1 -d "$CPP/$dirout" < "$CPP/darwin/patch-src-shared-CLucene-LuceneThreads.h.diff"
      cmake "$DBG" -G "Unix Makefiles" -D CMAKE_TOOLCHAIN_FILE="$CPP/darwin/toolchain.cmake" -C "$CPP/darwin/clucene-TryRunResult.cmake" -D BUILD_STATIC_LIBRARIES=ON -D ZLIB_INCLUDE_DIR="$MACINST/include" -D ZLIB_LIBRARY="$MACINST/lib/libz.a" ..
      make DESTDIR="$CPP/install.darwin-$MACARCH" install
    fi
  done
fi
########################################################################


########################################################################
# COMPILE LIBSWORD
# svn rev 3900 is 2025-03-03
swordRev=3900
url="http://crosswire.org/svn/sword/trunk"
gzfile="sword-rev-${swordRev}.tar.gz"
dirin="sword-$swordRev"
dirout="sword"
if [ ! -e "$CPP/sword" ]; then
  getSource
  # Use custom Versification maps
  cp -r "$CPP/sword-versification-maps/sword/"* "$CPP/sword"
  cmake "$DBG" -D SWORD_NO_ICU="Yes" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$CPP/install/usr/local/lib/libclucene-core.so" -D ZLIB_LIBRARY="$CPP/install/usr/local/lib/libz.so" -D CLUCENE_LIBRARY_DIR="$CPP/install/usr/local/include" -D CLUCENE_INCLUDE_DIR="$CPP/install/usr/local/include" -D ZLIB_INCLUDE_DIR="$CPP/install/usr/local/include" -DSWORD_BUILD_UTILS="Yes" ..
  make DESTDIR="$CPP/install" install
fi
# CROSS COMPILE LIBSWORD TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  dirout="sword.$XCWD"
  if [ ! -e "$CPP/sword.$XCWD" ]; then
    getSource
    # Use custom Versification maps
    cp -r "$CPP/sword-versification-maps/sword/"* "$CPP/sword.$XCWD"
    # SWORD's CMakeLists.txt requires clucene-config.h be located in a weird directory:
    cp -r "$CPP/install.$XCWD/usr/local/include/CLucene" "$CPP/install.$XCWD/usr/local/lib"
    cd "$CPP" || exit 5
    patch -s -p0 -d "$CPP/sword.$XCWD" < "$CPP/windows/libsword-src.patch"
    cd "$CPP/sword.$XCWD/build" || exit 5
    cmake "$DBG" -DCMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" -D SWORD_NO_ICU="Yes" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$CPP/install.$XCWD/usr/local/lib/libclucene-core.dll.a" -D ZLIB_LIBRARY="$CPP/install.$XCWD/usr/local/lib/libzlibstatic.a" -D CLUCENE_LIBRARY_DIR="$CPP/install.$XCWD/usr/local/include" -D CLUCENE_INCLUDE_DIR="$CPP/install.$XCWD/usr/local/include" -D ZLIB_INCLUDE_DIR="$CPP/install.$XCWD/usr/local/include" -DSWORD_BUILD_UTILS="No" ..
    make DESTDIR="$CPP/install.$XCWD" install
  fi
fi
# CROSS COMPILE LIBSWORD TO MACOS
if [[ "$MACMACHINE" != "no" ]]; then
  for MACARCH in $MACOS_ARCHS; do
    export MACARCH
    dirout="sword.darwin-$MACARCH"
    if [ ! -e "$CPP/$dirout" ]; then
      getSource
      MACINST="$CPP/install.darwin-$MACARCH/usr/local"
      # Use custom Versification maps
      cp -r "$CPP/sword-versification-maps/sword/"* "$CPP/$dirout"
      # ftplib only knows __unix__, which MacOS does not define.
      sed -i 's/defined(__unix__)/(defined(__unix__) || defined(__APPLE__))/' "$CPP/$dirout/src/utilfuns/ftplib.c" "$CPP/$dirout/include/ftplib.h"
      # SWORD's CMake installs to /opt/local on APPLE, and would also find
      # curl, bzip2 and xz in the SDK, which the Linux build does not use.
      cmake "$DBG" -D CMAKE_TOOLCHAIN_FILE="$CPP/darwin/toolchain.cmake" -D CMAKE_INSTALL_PREFIX="/usr/local" -D SWORD_NO_ICU="Yes" -D SWORD_NO_CURL="Yes" -D SWORD_NO_BZIP2="Yes" -D SWORD_NO_XZ="Yes" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$MACINST/lib/libclucene-core-static.a;$MACINST/lib/libclucene-shared-static.a" -D ZLIB_LIBRARY="$MACINST/lib/libz.a" -D CLUCENE_LIBRARY_DIR="$MACINST/include" -D CLUCENE_INCLUDE_DIR="$MACINST/include" -D ZLIB_INCLUDE_DIR="$MACINST/include" -DSWORD_BUILD_UTILS="No" ..
      make DESTDIR="$CPP/install.darwin-$MACARCH" install
    fi
  done
fi
########################################################################


########################################################################
# COMPILE AND INSTALL LIBXULSWORD
if [ ! -e "$CPP/build" ]; then
  mkdir "$CPP/build"
  cd "$CPP/build" || exit 5
  cmake "$DBG" -D SWORD_NO_ICU="Yes" -D CMAKE_INCLUDE_PATH="$CPP/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$CPP/install/usr/local/lib" -D LIB_INSTALL_DIR="$CPP/install/usr/local/lib" ..
  make install
fi
# CROSS COMPILE LIBXULSWORD TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  if [ ! -e "$CPP/build.$XCWD" ]; then
    mkdir "$CPP/build.$XCWD"
    cd "$CPP/build.$XCWD" || exit 5
    cmake "$DBG" -DCMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" -D SWORD_NO_ICU="Yes" -D CMAKE_INCLUDE_PATH="$CPP/install.$XCWD/usr/local/include" -D CMAKE_LIBRARY_PATH="$CPP/install.$XCWD/usr/local/lib" -D LIB_INSTALL_DIR="$CPP/install.$XCWD/usr/local/lib" ..
    make install
  fi
fi
# CROSS COMPILE LIBXULSWORD TO MACOS
if [[ "$MACMACHINE" != "no" ]]; then
  for MACARCH in $MACOS_ARCHS; do
    export MACARCH
    if [ ! -e "$CPP/build.darwin-$MACARCH" ]; then
      mkdir "$CPP/build.darwin-$MACARCH"
      cd "$CPP/build.darwin-$MACARCH" || exit 5
      MACINST="$CPP/install.darwin-$MACARCH/usr/local"
      cmake "$DBG" -D CMAKE_TOOLCHAIN_FILE="$CPP/darwin/toolchain.cmake" -D SWORD_NO_ICU="Yes" -D CMAKE_INCLUDE_PATH="$MACINST/include" -D CMAKE_LIBRARY_PATH="$MACINST/lib" -D LIB_INSTALL_DIR="$MACINST/lib" ..
      make install
    fi
  done
fi
########################################################################

# Install the lib and all dependencies and strip them
LIBDIRNAME=lib
if [[ "$(lsb_release -cs)" == "jammy" ]]; then LIBDIRNAME=lib-core22; fi
LIBDIR="$CPP/$LIBDIRNAME"
# Stop here if the build failed, so an existing library (including the
# host's copy) is not replaced by an empty directory.
if [ ! -e "$CPP/install/usr/local/lib/libxulsword-static.so" ]; then
  echo "ERROR: libxulsword build failed: $CPP/install/usr/local/lib/libxulsword-static.so was not created."
  exit 1
fi
if [ -e "$LIBDIR" ]; then rm -rf "$LIBDIR"; fi
mkdir "$LIBDIR"
cp "$CPP/install/usr/local/lib/libxulsword-static.so" "$LIBDIR"
if [ -z "$DBG" ]; then
  strip "$LIBDIR/"*
fi
chmod ugo+x "$LIBDIR/"*

# If COPY_TO_HOST then copy the finished library to the host machine
if [ -n "$COPY_TO_HOST" ]; then
  HLIBDIR="/vagrant/Cpp/$LIBDIRNAME"
  if [ -e "$HLIBDIR" ]; then rm -rf "$HLIBDIR"; fi
  cp -r "$LIBDIR" "$HLIBDIR"
fi

if [[ "$WINMACHINE" != "no" ]]; then
  # Install the DLL and all ming dependencies beyond the node executable and strip them
  LIBDIR="$CPP/lib.$XCWD"
  if [ -e "$LIBDIR" ]; then rm -rf "$LIBDIR"; fi
  GCCDLL=libgcc_s_seh-1.dll
  if [[ "$XCWD" == "32win" ]]; then
    GCCDLL=libgcc_s_dw2-1.dll
  fi
  mkdir "$LIBDIR"
  cp "$CPP/install.$XCWD/usr/local/lib/libxulsword-static.dll" "$LIBDIR"
  cp "/usr/lib/gcc/${TOOLCHAIN_PREFIX}/13-${GCCSTD}/$GCCDLL" "$LIBDIR"
  cp "/usr/lib/gcc/${TOOLCHAIN_PREFIX}/13-${GCCSTD}/libstdc++-6.dll" "$LIBDIR"
  cp "/usr/${TOOLCHAIN_PREFIX}/lib/libwinpthread-1.dll" "$LIBDIR"
  gendef - "$CPP/install.$XCWD/usr/local/lib/libxulsword-static.dll" > "$LIBXULSWORD/lib/libxulsword.def"
  if [ -z "$DBG" ]; then
    strip "$LIBDIR/"*
  fi
  chmod ugo+x "$LIBDIR/"*

  # If COPY_TO_HOST then copy the finished library to the host machine
  if [ -n "$COPY_TO_HOST" ]; then
    HLIBDIR="/vagrant/Cpp/lib.$XCWD"
    if [ -e "$HLIBDIR" ]; then rm -rf "$HLIBDIR"; fi
    cp -r "$LIBDIR" "$HLIBDIR"
  fi
fi

if [[ "$MACMACHINE" != "no" ]]; then
  # Merge the MacOS architectures into a universal dylib. Also build the
  # libxulsword.node addon here, since node-gyp cannot cross-compile, and
  # merge it into a universal binary. The addon finds the dylib through
  # @loader_path, so the two must be installed side by side (install.mjs).
  # Nothing is stripped afterwards, since that would break the arm64 ad-hoc
  # code signature which the linker adds (local symbols are stripped by -x).
  LIBDIR="$CPP/lib.darwin"
  if [ -e "$LIBDIR" ]; then rm -rf "$LIBDIR"; fi
  mkdir "$LIBDIR"
  ADDONDIR="$XULSWORD/libxulsword/bin/darwin-universal-89"
  if [ ! -e "$ADDONDIR" ]; then mkdir -p "$ADDONDIR"; fi
  NODE_INC="$(node -p "require('path').join(process.execPath, '../../include/node')")"
  NAPI_INC="$(cd "$XULSWORD/libxulsword" && node -p "require('path').resolve(require('node-addon-api').include_dir)")"
  DYLIBS=()
  ADDONS=()
  for MACARCH in $MACOS_ARCHS; do
    MACINST="$CPP/install.darwin-$MACARCH/usr/local"
    ADDON="$CPP/build.darwin-$MACARCH/libxulsword.node"
    "$LLVM_BIN/clang++" --target="$MACARCH-apple-macos$MACOS_DEPLOYMENT_TARGET" -isysroot "$MACSDK" -fuse-ld=lld \
      -std=gnu++17 -O2 -fvisibility=hidden -DNODE_GYP_MODULE_NAME=libxulsword -DBUILDING_NODE_EXTENSION \
      -I"$NODE_INC" -I"$NAPI_INC" -I"$CPP/src/include" -I"$CPP/sword.darwin-$MACARCH/include" \
      "$XULSWORD/libxulsword/src/libxulsword.cpp" \
      -bundle -undefined dynamic_lookup -Wl,-x -L"$MACINST/lib" -lxulsword-static -Wl,-rpath,@loader_path \
      -o "$ADDON" || exit 1
    DYLIBS+=("$MACINST/lib/libxulsword-static.dylib")
    ADDONS+=("$ADDON")
  done
  "$LLVM_BIN/llvm-lipo" -create "${DYLIBS[@]}" -output "$LIBDIR/libxulsword-static.dylib" || exit 1
  "$LLVM_BIN/llvm-lipo" -create "${ADDONS[@]}" -output "$ADDONDIR/libxulsword.node" || exit 1
  for f in "$LIBDIR/libxulsword-static.dylib" "$ADDONDIR/libxulsword.node"; do
    "$LLVM_BIN/llvm-lipo" -info "$f"
    "$LLVM_BIN/llvm-otool" -L "$f"
  done
fi

if [[ "$LIBXULSWORD_ONLY" == "yes" ]]; then exit 0; fi

########################################################################
# WRAP UP

echo "Initializing node.js"
cd "$XULSWORD" || exit 5
yarn

echo "Copying node_modules to host"
if [ -n "$COPY_TO_HOST" ]; then
  if [ ! -e "/vagrant/node_modules" ]; then
    cp -r "$XULSWORD/node_modules" "/vagrant"
  fi
fi

if [[ "$WINMACHINE" != "no" ]]; then
  if [[ "$VAGRANT" != "guest" ]]; then
    winecfg
  fi
fi
########################################################################

#sudo snap install snapcraft --classic
##sudo snap install lxd
##lxd init

