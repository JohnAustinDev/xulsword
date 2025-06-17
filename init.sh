#!/bin/bash

export XULSWORD
export CPP
export NVM_DIR
export VAGRANT

cd "$( dirname "${BASH_SOURCE[0]}" )" || exit 5
XULSWORD=$( pwd )

# This script installs dependencies and builds the libxulsword
# dynamic library and libxulsword native node-module.

if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Exiting..."
   exit 1
fi

if [[ -e "/vagrant" ]]; then VAGRANT="guest"; else VAGRANT="host"; fi

if [[ "$VAGRANT" == "guest" ]]; then XULSWORD=/vagrant; fi
if [[ ! -e "$XULSWORD/setenv" ]]; then cp "$XULSWORD/scripts/setenv" "$XULSWORD"; fi
source "$XULSWORD/setenv"
if [[ "$VAGRANT" == "guest" ]]; then XULSWORD=/vagrant; fi

DEBVERS="$(lsb_release -cs 2>/dev/null)"

DBG=
# DBG='-D CMAKE_BUILD_TYPE=Debug'

# BUILD DEPENDENCIES (Ubuntu Xenial & Bionic)
PKG_DEPS="build-essential git subversion libtool-bin cmake autoconf make pkg-config zip curl"
# for xulsword
PKG_DEPS="$PKG_DEPS debhelper binutils gcc-multilib dpkg-dev debhelper libboost-dev"
# for ZLib build
PKG_DEPS="$PKG_DEPS debhelper binutils gcc-multilib dpkg-dev"
# for Clucene build
PKG_DEPS="$PKG_DEPS debhelper libboost-dev"
# for VM build
if [[ "$VAGRANT" == "guest" ]]; then PKG_DEPS="$PKG_DEPS libxshmfence1 libglu1 libnss3-dev libgdk-pixbuf2.0-dev libgtk-3-dev libxss-dev libasound2"; fi

if [[ "$WINMACHINE" != "no" ]]; then
  # BUILD DEPENDENCIES (for cross compiling libxulsword as a Windows dll)
  PKG_DEPS="$PKG_DEPS mingw-w64 mingw-w64-tools wine wine32-preloader"
fi

# BUILD DEPENDENCIES (for cross compiling libxulsword as MacOS dylib)
# PKG_DEPS="$PKG_DEPS llvm-12 llvm-12-linker-tools llvm-12-tools clang-12 lldb-12 lld-12"

if [ "$(dpkg -l $PKG_DEPS 2>&1 | grep "no packages" | wc -m)" -ne 0 ]; then
  if [[ "$VAGRANT" == "guest" ]]; then
    sudo dpkg --add-architecture i386
    sudo apt-get update
    sudo apt-get install -y $PKG_DEPS
  else
    echo First, you need to install missing packages with:
    echo .
    echo "sudo apt-get install ${PKG_DEPS}"
    echo .
    echo Then run this script again.
    exit;
  fi
fi

# If XULSWORD is /vagrant, then clone the host code to VM and build
# everything within the VM so as not to fill the host with build files
# for another machine. Then copy only the output files to the host.
# Also git must be used (vs. copied from host) so that line endings will
# be correct on both the host and the guest.
COPY_TO_HOST=
if [[ "$XULSWORD" == "/vagrant" ]]; then
  COPY_TO_HOST=1
  if [ ! -e "$HOME/src" ]; then
    mkdir "$HOME/src";
    cd "$HOME/src" || exit 5
    git clone https://github.com/JohnAustinDev/xulsword
  else
    cd "$HOME/src/xulsword" ||exit 5
    git pull
  fi
  XULSWORD="$HOME/src/xulsword"
  if [[ ! -e "$XULSWORD/setenv" ]]; then cp "$XULSWORD/scripts/setenv" "$XULSWORD"; fi
fi

echo "XULSWORD IS $XULSWORD"
cd "$XULSWORD" || exit 5
CPP="$XULSWORD/Cpp"

if [[ "$LIBXULSWORD_ONLY" == "no" ]]; then
  # Install node.js using nvm so our dev environment can use the latest
  # LTS version of node.js. Then install yarn and dependant node modules.
  NVM_DIR="$HOME/.nvm"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

  nvm install 22.2.0
  nvm use 22.2.0
  corepack enable
  yarn set version stable
  yarn install
fi

# Create a local Cpp installation directory where compiled libraries will
# be installed for libxulsword linking.
if [ ! -e "$XULSWORD/Cpp/install" ]; then mkdir "$XULSWORD/Cpp/install"; fi
if [[ "$WINMACHINE" != "no" ]]; then
  if [ ! -e "$XULSWORD/Cpp/install.$XCWD" ]; then mkdir "$XULSWORD/Cpp/install.$XCWD"; fi
fi

# Create a local lib directory where libxulsword will be installed
if [ ! -e "$XULSWORD/Cpp/lib" ]; then mkdir "$XULSWORD/Cpp/lib"; fi
if [[ "$WINMACHINE" != "no" ]]; then
  if [ ! -e "$XULSWORD/Cpp/lib.$XCWD" ]; then mkdir "$XULSWORD/Cpp/lib.$XCWD"; fi
fi

# Create an archive directory to cache source code
ARCHIVEDIR="$XULSWORD/archive"
if [ ! -e "$ARCHIVEDIR" ]; then mkdir "$ARCHIVEDIR"; fi
if [ -e "/vagrant/archive" ]; then ARCHHOST="/vagrant/archive"; else ARCHHOST=$ARCHIVEDIR; fi

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
# COMPILE ZLIB
url="http://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib_1.2.8.dfsg.orig.tar.gz"
gzfile="zlib_1.2.8.dfsg.orig.tar.gz"
dirin="zlib-1.2.8"
dirout="zlib"
if [ ! -e "$CPP/$dirout" ]; then
  getSource
  cmake "$DBG" -G "Unix Makefiles" -D CMAKE_C_FLAGS="-fPIC" ..
  make DESTDIR="$XULSWORD/Cpp/install" install
  # create a symlink to zconf.h (which was just renamed by cmake) so CLucene will compile
  ##ln -s ./build/zconf.h ../zconf.h
fi
# CROSS COMPILE ZLIB TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  dirout="zlib.$XCWD"
  if [ ! -e "$CPP/$dirout" ]; then
    getSource
    cmake "$DBG" -G "Unix Makefiles" -D CMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" ..
    make DESTDIR="$CPP/install.$XCWD" install
  fi
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
if [ ! -e "$CPP/$dirout" ]; then
  getSource
   # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
  sed -i 's/!allowLeadingWildcard/!true/g' "$CPP/$dirout/src/core/CLucene/queryParser/QueryParser.cpp"
  # -D DISABLE_MULTITHREADING=ON causes compilation to fail
  sed -i '11i #include <ctime>' "$CPP/$dirout/src/core/CLucene/document/DateTools.cpp"
  cmake "$DBG" -G "Unix Makefiles" -D BUILD_STATIC_LIBRARIES=ON -D CMAKE_INCLUDE_PATH="$CPP/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$CPP/install/usr/local/lib" ..
  make DESTDIR="$CPP/install" install
fi
# CROSS COMPILE LIBCLUCENE TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  dirout="clucene.$XCWD"
  if [ ! -e "$CPP/$dirout" ]; then
    getSource
    # Stop this dumb clucene error for searches beginning with a wildcard, which results in a core dump.
    sed -i 's/!allowLeadingWildcard/!true/g' "$CPP/$dirout/src/core/CLucene/queryParser/QueryParser.cpp"
    cd "$CPP" || exit 5
    patch -s -p0 -d "$CPP/$dirout" < "$CPP/windows/clucene-src.patch"
    cd "$CPP/$dirout/build" || exit 5
    cmake "$DBG" -DCMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" -C "$CPP/windows/clucene-TryRunResult-${GCCSTD}.cmake" -D CMAKE_USE_PTHREADS_INIT=OFF -D BUILD_STATIC_LIBRARIES=ON -D ZLIB_INCLUDE_DIR="$CPP/install.$XCWD/usr/local/include" -D Boost_INCLUDE_DIR="$BOOSTDIR/$XCWD/include" -D ZLIB_LIBRARY="$CPP/install.$XCWD/usr/local/lib/libzlibstatic.a" ..
    patch -s -p0 -d "$CPP/$dirout" < "$CPP/windows/clucene-build.patch"
    make DESTDIR="$CPP/install.$XCWD" install
  fi
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
if [ ! -e "$CPP/$dirout" ]; then
  getSource
  # Use custom Versification maps
  cp -r "$CPP/sword-versification-maps/sword/"* "$CPP/sword"
  cmake "$DBG" -D SWORD_NO_ICU="Yes" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$CPP/install/usr/local/lib/libclucene-core.so" -D ZLIB_LIBRARY="$CPP/install/usr/local/lib/libz.so" -D CLUCENE_LIBRARY_DIR="$CPP/install/usr/local/include" -D CLUCENE_INCLUDE_DIR="$CPP/install/usr/local/include" -D ZLIB_INCLUDE_DIR="$CPP/install/usr/local/include" -DSWORD_BUILD_UTILS="Yes" ..
  make DESTDIR="$CPP/install" install
fi
# CROSS COMPILE LIBSWORD TO WINDOWS
if [[ "$WINMACHINE" != "no" ]]; then
  dirout="sword.$XCWD"
  if [ ! -e "$CPP/$dirout" ]; then
    getSource
    # Use custom Versification maps
    cp -r "$CPP/sword-versification-maps/sword/"* "$CPP/sword"
    # SWORD's CMakeLists.txt requires clucene-config.h be located in a weird directory:
    cp -r "$CPP/install.$XCWD/usr/local/include/CLucene" "$CPP/install.$XCWD/usr/local/lib"
    cd "$CPP" || exit 5
    patch -s -p0 -d "$CPP/$dirout" < "$CPP/windows/libsword-src.patch"
    cd "$CPP/$dirout/build" || exit 5
    cmake "$DBG" -DCMAKE_TOOLCHAIN_FILE="$CPP/windows/toolchain.cmake" -D SWORD_NO_ICU="Yes" -D LIBSWORD_LIBRARY_TYPE="Static" -D CLUCENE_LIBRARY="$CPP/install.$XCWD/usr/local/lib/libclucene-core.dll.a" -D ZLIB_LIBRARY="$CPP/install.$XCWD/usr/local/lib/libzlibstatic.a" -D CLUCENE_LIBRARY_DIR="$CPP/install.$XCWD/usr/local/include" -D CLUCENE_INCLUDE_DIR="$CPP/install.$XCWD/usr/local/include" -D ZLIB_INCLUDE_DIR="$CPP/install.$XCWD/usr/local/include" -DSWORD_BUILD_UTILS="No" ..
    make DESTDIR="$CPP/install.$XCWD" install
  fi
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
########################################################################

# Install the lib and all dependencies and strip them
LIBDIR="$CPP/lib"
if [ -e "$LIBDIR" ]; then rm -rf "$LIBDIR"; fi
mkdir "$LIBDIR"
cp "$CPP/install/usr/local/lib/libxulsword-static.so" "$LIBDIR"
if [ -z "$DBG" ]; then
  strip "$LIBDIR/"*
fi
chmod ugo+x "$LIBDIR/"*

# If COPY_TO_HOST then copy the finished library to the host machine
if [ -n "$COPY_TO_HOST" ]; then
  HLIBDIR="/vagrant/Cpp/lib"
  if [ -e "$HLIBDIR" ]; then rm -rf "$HLIBDIR"; fi
  cp -r "$LIBDIR" "$HLIBDIR"
fi
if [[ "$WINMACHINE" != "no" ]]; then
  # Install the DLL and all ming dependencies beyond the node executable and strip them
  LIBDIR="$CPP/lib.$XCWD"
  if [ -e "$LIBDIR" ]; then rm -rf "$LIBDIR"; fi
  GCCDLL=libgcc_s_seh-1.dll
  if [[ "$XCWD" == "32win" ]]; then
    GCCDLL=libgcc_s_sjlj-1.dll
  fi
  mkdir "$LIBDIR"
  cp "$CPP/install.$XCWD/usr/local/bin/libxulsword-static.dll" "$LIBDIR"
  cp "/usr/lib/gcc/${TOOLCHAIN_PREFIX}/9.3-${GCCSTD}/$GCCDLL" "$LIBDIR"
  cp "/usr/lib/gcc/${TOOLCHAIN_PREFIX}/9.3-${GCCSTD}/libstdc++-6.dll" "$LIBDIR"
  cp "/usr/${TOOLCHAIN_PREFIX}/lib/libwinpthread-1.dll" "$LIBDIR"
  gendef - "$CPP/install.$XCWD/usr/local/bin/libxulsword-static.dll" > "$LIBXULSWORD/lib/libxulsword.def"
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

if [[ "$LIBXULSWORD_ONLY" == "yes" ]]; then exit 0; fi

########################################################################
# WRAP UP

# Now initialize node.js
cd "$XULSWORD" || exit 5
yarn

# If COPY_TO_HOST then copy node_modules to host to save download time
if [ -n "$COPY_TO_HOST" ]; then
  if [ ! -e "/vagrant/node_modules" ]; then
    cp -r "$XULSWORD/node_modules" "/vagrant"
  fi
fi
########################################################################

#sudo snap install snapcraft --classic
##sudo snap install lxd
##lxd init

# Old Darwin Clucene
#if [ $(uname | grep Darwin) ]; then
#  # patch clucene for OSX build (https://stackoverflow.com/questions/28113556/error-while-making-clucene-for-max-os-x-10-10/28175358#28175358)
#  pushd "$XULSWORD/Cpp/clucene/src/shared/CLucene"
#  patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-LuceneThreads.h.diff
#  cd config
#  patch < $XULSWORD/Cpp/patch/patch-src-shared-CLucene-config-repl_tchar.h.diff
#  popd
#fi

# Old Darwin libxulsword
#  if [ $(uname | grep Darwin) ]; then
#    # patch untgz MAC compile problem
#    perl -p -i -e 's/#ifdef unix/#if defined(unix) || defined(__APPLE__)/g' ./sword/src/utilfuns/zlib/untgz.c
#  fi


