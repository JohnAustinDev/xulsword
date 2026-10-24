#!/bin/bash

# This script builds the libxulsword binaries, and nothing else. The
# libxulsword dynamic library and the libxulsword.node addon for each system
# go to the same directory:
#   Linux:   Cpp/lib
#   Windows: Cpp/lib.32win or Cpp/lib.64win (with the MinGW runtime DLLs)
#   MacOS:   Cpp/lib.darwin
# The Windows and MacOS binaries are only built if they are enabled by
# WINMACHINE and MACMACHINE in setenv.
#
# It is normally run as a 'guest' in a Docker container by docker-build.sh,
# with the host's xulsword directory mounted at /host. The guest installs any
# missing build dependencies, builds a copy of the host's code, and copies
# the finished binaries to the host's xulsword directory.
#
# It can also be run directly on Ubuntu 24.04. It then builds in this
# xulsword directory, and lists any missing packages for you to install.

export XULSWORD
export CPP

# CMake 4 refuses projects which require a CMake version below 3.5, which
# includes zlib, clucene, sword and libxulsword. Older CMake ignores this.
export CMAKE_POLICY_VERSION_MINIMUM=3.5

if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Exiting..."
   exit 1
fi

# This script is in xulsword/Cpp, so start in the xulsword directory.
cd "$( dirname "${BASH_SOURCE[0]}" )/.." || exit 5

HOSTDIR=/host
if [[ -d "$HOSTDIR" && ( -e "/.dockerenv" || -e "/run/.containerenv" ) ]]; then
  RUNCONTEXT="guest"
else
  RUNCONTEXT="host"
fi

DBG=
# DBG='-D CMAKE_BUILD_TYPE=Debug'

# Make sure Debian packages are installed. A guest installs them itself,
# otherwise the user is told how to install them.
# Usage: requireDeps <description> <package>...
function requireDeps() {
  local desc="$1"
  shift
  if [ "$(dpkg -l "$@" 2>&1 | grep "no packages" | wc -m)" -eq 0 ]; then return; fi
  if [[ "$RUNCONTEXT" == "guest" ]]; then
    echo "INSTALLING $desc BUILD DEPENDENCIES"
    sudo apt-get update
    if ! sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"; then
      echo "ERROR: Failed to install $desc build dependencies."
      exit 1
    fi
  else
    echo "You need to install missing $desc packages with:"
    echo .
    echo "sudo apt-get install $*"
    echo .
    echo "Then run this script again."
    exit 1
  fi
}

# BUILD DEPENDENCIES (git lists the files a guest copies, subversion gets
# the SWORD source, and Clucene needs the boost headers)
requireDeps "LINUX" build-essential cmake pkg-config curl git subversion libboost-dev

# If running as a guest, then copy the host's code into the guest and build
# everything there, so as not to contaminate the host's own build files.
# Then copy only the finished output libraries to the host.
COPY_TO_HOST=
if [[ "$RUNCONTEXT" == "guest" ]]; then
  XULSWORD="$HOME/src/xulsword"
  COPY_TO_HOST=1
  mkdir -p "$XULSWORD"
  # Copy the files that git tracks, as they are now (including uncommitted
  # changes), plus new files that git does not ignore. Tracked files that
  # were deleted on the host are deleted here too. Ignored build files from
  # earlier runs are kept, so that only what has changed is rebuilt.
  FILELIST="$(mktemp)"
  if ! git -C "$HOSTDIR" ls-files -z --cached --others --exclude-standard > "$FILELIST"; then
    echo "ERROR: Could not list the source files in $HOSTDIR (it must be a git checkout)."
    exit 1
  fi
  # rsync exits with 24 (files vanished) when a deleted file's directory was
  # deleted too. Such files are still deleted here, so this is not an error.
  rsync -a --from0 --files-from="$FILELIST" --delete-missing-args "$HOSTDIR/" "$XULSWORD/"
  RSYNC_EXIT=$?
  if [[ $RSYNC_EXIT -ne 0 && $RSYNC_EXIT -ne 24 ]]; then
    echo "ERROR: Could not copy the source files from $HOSTDIR."
    exit 1
  fi
  rm -f "$FILELIST"
  if [[ -e "$HOSTDIR/setenv" ]]; then cp "$HOSTDIR/setenv" "$XULSWORD"; fi
else
  XULSWORD=$( pwd )
fi

if [[ ! -e "$XULSWORD/setenv" ]]; then cp "$XULSWORD/scripts/setenv" "$XULSWORD"; fi
echo "XULSWORD IS $XULSWORD"
cd "$XULSWORD" || exit 5
source "./setenv"

echo "Building libxulsword for: Linux, Windows ($WINMACHINE), MacOS ($MACMACHINE)"

# BUILD DEPENDENCIES (for cross compiling libxulsword to Windows)
if [[ "$WINMACHINE" != "no" ]]; then
  MINGWARCH="${TOOLCHAIN_PREFIX%%-*}"
  MINGWARCH="${MINGWARCH//_/-}"
  requireDeps "WINDOWS X-COMPILE" "gcc-mingw-w64-$MINGWARCH-posix" "g++-mingw-w64-$MINGWARCH-posix"
fi

# BUILD DEPENDENCIES (for cross compiling libxulsword to MacOS)
if [[ "$MACMACHINE" != "no" ]]; then
  requireDeps "MACOS X-COMPILE" clang lld llvm xz-utils
fi

# The Windows and MacOS libxulsword.node addons are linked with LLVM's lld.
if [[ "$WINMACHINE" != "no" || "$MACMACHINE" != "no" ]]; then
  requireDeps "NODE ADDON X-COMPILE" clang lld llvm
  LLVM_BIN="$(llvm-config --bindir)"
  export LLVM_BIN
fi

# The libxulsword.node addons are compiled against the Node.js headers,
# which setenv provides by installing Node.js with nvm.
if [[ -z "$(command -v node)" || -z "$(command -v npm)" ]]; then
  echo "ERROR: Node.js is needed to build the libxulsword.node addons."
  echo "Install nvm (https://github.com/nvm-sh/nvm), which setenv uses to install"
  echo "Node.js. Then run this script again."
  exit 1
fi

CPP="$XULSWORD/Cpp"

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

# Create an archive directory to cache source code. A guest also uses the
# host's archive directory, so downloads are kept between --clean builds.
ARCHIVEDIR="$XULSWORD/archive"
if [[ ! -e "$ARCHIVEDIR" ]]; then mkdir "$ARCHIVEDIR"; fi
ARCHHOST="$ARCHIVEDIR"
if [[ "$RUNCONTEXT" == "guest" ]]; then
  mkdir -p "$HOSTDIR/archive"
  ARCHHOST="$HOSTDIR/archive"
fi

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
      if [[ "$ARCHHOST" != "$ARCHIVEDIR" ]]; then
        cp "$gzfile" "$ARCHHOST"
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
    exit 1;
  fi
  # Sleep was required for files to be immediately modifiable in a Debian bookworm VM.
  sleep 1
  echo "Finished getSource $dirin"
}

########################################################################
# MACOS SDK AND TOOLS
if [[ "$MACMACHINE" != "no" ]]; then
  # The MacOS SDK cannot be downloaded automatically.
  MACSDK="$CPP/$MACOS_SDK"
  if [ ! -e "$MACSDK" ]; then
    if [ ! -e "$ARCHIVEDIR/$MACOS_SDK.tar.xz" ] && [ -e "$ARCHHOST/$MACOS_SDK.tar.xz" ]; then
      cp "$ARCHHOST/$MACOS_SDK.tar.xz" "$ARCHIVEDIR"
    fi
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
# Unlike the libraries above, libxulsword is rebuilt (incrementally) each
# time this script runs, so that changes to its source are always built.
mkdir -p "$CPP/build"
cd "$CPP/build" || exit 5
if [ ! -e Makefile ]; then
  cmake "$DBG" -D SWORD_NO_ICU="Yes" -D CMAKE_INCLUDE_PATH="$CPP/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$CPP/install/usr/local/lib" -D LIB_INSTALL_DIR="$CPP/install/usr/local/lib" ..
fi
make install || exit 1
# CROSS COMPILE LIBXULSWORD TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  mkdir -p "$CPP/build.$XCWD"
  cd "$CPP/build.$XCWD" || exit 5
  if [ ! -e Makefile ]; then
    cmake "$DBG" -DCMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" -D SWORD_NO_ICU="Yes" -D CMAKE_INCLUDE_PATH="$CPP/install.$XCWD/usr/local/include" -D CMAKE_LIBRARY_PATH="$CPP/install.$XCWD/usr/local/lib" -D LIB_INSTALL_DIR="$CPP/install.$XCWD/usr/local/lib" ..
  fi
  make install || exit 1
fi
# CROSS COMPILE LIBXULSWORD TO MACOS
if [[ "$MACMACHINE" != "no" ]]; then
  for MACARCH in $MACOS_ARCHS; do
    export MACARCH
    mkdir -p "$CPP/build.darwin-$MACARCH"
    cd "$CPP/build.darwin-$MACARCH" || exit 5
    MACINST="$CPP/install.darwin-$MACARCH/usr/local"
    if [ ! -e Makefile ]; then
      cmake "$DBG" -D CMAKE_TOOLCHAIN_FILE="$CPP/darwin/toolchain.cmake" -D SWORD_NO_ICU="Yes" -D CMAKE_INCLUDE_PATH="$MACINST/include" -D CMAKE_LIBRARY_PATH="$MACINST/lib" -D LIB_INSTALL_DIR="$MACINST/lib" ..
    fi
    make install || exit 1
  done
fi
########################################################################

# Install the lib and all dependencies and strip them
LIBDIRNAME=lib
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

# NODE-API HEADERS
# The libxulsword.node addons are compiled here rather than by node-gyp,
# since node-gyp cannot cross-compile, and needs the SWORD headers, which
# only exist where this script builds SWORD. The addons only use Node-API,
# so they work with any version of Node.js or Electron. Windows also needs
# the list of Node-API functions from node-api-headers, to make an import
# library for them.
NODE_INC="$(node -p "require('path').join(process.execPath, '../../include/node')")"
NAPI_INC="$(cd "$XULSWORD/libxulsword" && node -p "require('path').resolve(require('node-addon-api').include_dir)" 2>/dev/null)"
if [ -z "$NAPI_INC" ]; then
  # Without node_modules (as in a guest) install just node-addon-api.
  NAPIDIR="$CPP/node-addon-api"
  if [ ! -e "$NAPIDIR/node_modules/node-addon-api" ]; then
    npm install --prefix "$NAPIDIR" --no-save --no-package-lock node-addon-api@7.1.1 || exit 1
  fi
  NAPI_INC="$(cd "$NAPIDIR" && node -p "require('path').resolve(require('node-addon-api').include_dir)")"
fi

# Build the Linux libxulsword.node addon. Like the node-gyp build it
# replaces, it finds libxulsword-static.so through the library search path
# (the Linux package installs it alongside the main executable).
g++ -std=gnu++17 -O2 -fPIC -fvisibility=hidden -shared \
  -DNODE_GYP_MODULE_NAME=libxulsword -DBUILDING_NODE_EXTENSION \
  -I"$NODE_INC" -I"$NAPI_INC" -I"$CPP/src/include" -I"$CPP/sword/include" \
  "$XULSWORD/libxulsword/src/libxulsword.cpp" \
  -L"$CPP/install/usr/local/lib" -lxulsword-static \
  -o "$LIBDIR/libxulsword.node" || exit 1
if [ -z "$DBG" ]; then
  strip "$LIBDIR/libxulsword.node"
fi
readelf -d "$LIBDIR/libxulsword.node" | grep NEEDED

# If COPY_TO_HOST then copy the finished library and addon to the host machine
if [ -n "$COPY_TO_HOST" ]; then
  HLIBDIR="$HOSTDIR/Cpp/$LIBDIRNAME"
  if [ -e "$HLIBDIR" ]; then rm -rf "$HLIBDIR"; fi
  cp -r "$LIBDIR" "$HLIBDIR"
fi

if [[ "$WINMACHINE" != "no" ]]; then
  NAPIHDIR="$CPP/node-api-headers"
  if [ ! -e "$NAPIHDIR/node_modules/node-api-headers" ]; then
    npm install --prefix "$NAPIHDIR" --no-save --no-package-lock node-api-headers@1.9.0 || exit 1
  fi
  NAPI_DEF="$NAPIHDIR/node_modules/node-api-headers/def/node_api.def"
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
  if [ -z "$DBG" ]; then
    strip "$LIBDIR/"*
  fi
  chmod ugo+x "$LIBDIR/"*

  # Build the libxulsword.node addon. It uses the same MinGW runtime DLLs
  # as the libxulsword DLL, and scripts/install-libxulsword.mjs puts them all
  # side by side.
  # The addon delay-loads the Node-API functions from node.exe, and
  # win_delay_load_hook.c redirects them to the running program (see
  # libxulsword/Readme.md). It is linked with lld, because GNU ld makes
  # broken delay-load imports, and lld can only delay-load from an import
  # library made by llvm-dlltool.
  ADDONBUILD="$CPP/build.$XCWD/addon"
  mkdir -p "$ADDONBUILD"
  if [[ "$XCWD" == "32win" ]]; then
    DLLTOOLARCH=i386
    # GCC 13's <iostream> refers to std::ios_base_library_init() without the
    # leading underscore that 32 bit Windows adds to C++ names. GNU ld
    # ignores this, but lld needs to be told the right name.
    ADDONLDFLAGS=(-Wl,--Xlink=-alternatename:_ZSt21ios_base_library_initv=__ZSt21ios_base_library_initv)
  else
    DLLTOOLARCH=i386:x86-64
    ADDONLDFLAGS=()
  fi
  "$LLVM_BIN/llvm-dlltool" -m "$DLLTOOLARCH" -d "$NAPI_DEF" -D node.exe -l "$ADDONBUILD/libnode.a" || exit 1
  "$TOOLCHAIN_PREFIX-gcc-$GCCSTD" -O2 -c "$XULSWORD/libxulsword/src/win_delay_load_hook.c" \
    -o "$ADDONBUILD/win_delay_load_hook.o" || exit 1
  "$TOOLCHAIN_PREFIX-g++-$GCCSTD" -std=gnu++17 -O2 \
    -DNODE_GYP_MODULE_NAME=libxulsword -DBUILDING_NODE_EXTENSION -DNAPI_DISABLE_CPP_EXCEPTIONS \
    -I"$NODE_INC" -I"$NAPI_INC" -I"$CPP/src/include" -I"$CPP/sword.$XCWD/include" \
    -c "$XULSWORD/libxulsword/src/libxulsword.cpp" -o "$ADDONBUILD/libxulsword.o" || exit 1
  # Without a timestamp, rebuilding unchanged code gives an identical binary.
  "$LLVM_BIN/clang++" --target="$TOOLCHAIN_PREFIX" -fuse-ld=lld -shared -s -Wl,--no-insert-timestamp \
    "$ADDONBUILD/libxulsword.o" "$ADDONBUILD/win_delay_load_hook.o" \
    "$CPP/install.$XCWD/usr/local/lib/libxulsword-static.dll.a" "$ADDONBUILD/libnode.a" \
    -Wl,--delayload=node.exe "${ADDONLDFLAGS[@]}" -o "$LIBDIR/libxulsword.node" || exit 1
  "$LLVM_BIN/llvm-readobj" --coff-imports "$LIBDIR/libxulsword.node" | grep -E "^ *Name:"

  # If COPY_TO_HOST then copy the finished libraries and addon to the host machine
  if [ -n "$COPY_TO_HOST" ]; then
    HLIBDIR="$HOSTDIR/Cpp/lib.$XCWD"
    if [ -e "$HLIBDIR" ]; then rm -rf "$HLIBDIR"; fi
    cp -r "$LIBDIR" "$HLIBDIR"
  fi
fi

if [[ "$MACMACHINE" != "no" ]]; then
  # Merge the MacOS architectures into a universal dylib. Also build the
  # libxulsword.node addon here, since node-gyp cannot cross-compile, and
  # merge it into a universal binary. The addon finds the dylib through
  # @loader_path, so the two must be installed side by side
  # (scripts/install-libxulsword.mjs). Nothing is stripped afterwards, since
  # that would break the arm64 ad-hoc code signature which the linker adds
  # (local symbols are stripped by -x).
  LIBDIR="$CPP/lib.darwin"
  if [ -e "$LIBDIR" ]; then rm -rf "$LIBDIR"; fi
  mkdir "$LIBDIR"
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
  "$LLVM_BIN/llvm-lipo" -create "${ADDONS[@]}" -output "$LIBDIR/libxulsword.node" || exit 1
  for f in "$LIBDIR/libxulsword-static.dylib" "$LIBDIR/libxulsword.node"; do
    "$LLVM_BIN/llvm-lipo" -info "$f"
    "$LLVM_BIN/llvm-otool" -L "$f"
  done

  # If COPY_TO_HOST then copy the finished library and addon to the host machine
  if [ -n "$COPY_TO_HOST" ]; then
    HLIBDIR="$HOSTDIR/Cpp/lib.darwin"
    if [ -e "$HLIBDIR" ]; then rm -rf "$HLIBDIR"; fi
    cp -r "$LIBDIR" "$HLIBDIR"
  fi
fi

