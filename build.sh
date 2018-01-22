#!/bin/bash

# This script should NOT be run as root (privileged: false in Vagrantfile)

# This script can be run on a linux, OSX or vagrant machine. It
# installs any necessary dependencies and builds xulsword using the
# loc_MK.txt build settings if this file exists (otherwise defaults).

cd `dirname $0`

COMPILE_ONLY=$1
EXTRAS=IBTXulsword
if [ -e /vagrant ] && [ -e /home/vagrant ]; then MODE="guest"; else MODE="host"; fi

# Install build tools if needed
if [ ! -e /vagrant ] || [ ! -e "$HOME/src/xulsword/Cpp/build" ]; then
  if [ $(uname | grep Darwin) ]; then
    echo Running on OSX
    brew update
    brew install wget
    brew install autoconf
    brew install automake
    brew install subversion
    brew install libtool
  else
    echo Running on Linux
    sudo apt-get update
    sudo apt-get install -y build-essential git subversion libtool-bin cmake autoconf make pkg-config zip
  fi
  git config --global user.email "vm@vagrant.net"
  git config --global user.name "Vagrant User"
fi

# If this is xulsword Vagrant, then copy xulsword code locally so as not to 
# disturb any build files on the host machine!
if [ $MODE -eq "guest" ]; then
  # save any existing build files
  if [ -e "$HOME/src/xulsword/Cpp/install" ]; then mv "$HOME/src/xulsword/Cpp/install" "$HOME"; fi
  if [ -e "$HOME/src/xulsword/Cpp/build" ];   then mv "$HOME/src/xulsword/Cpp/build"   "$HOME"; fi
  
  if [ -e "$HOME/src/xulsword" ]; then
    rm -rf "$HOME/src/xulsword"
  fi
  mkdir -p "$HOME/src/xulsword"
  cd /vagrant
  stash=`git stash create`
  if [ ! $stash ]; then stash=`git rev-parse HEAD`; fi
  git archive -o archive.zip $stash
  mv archive.zip "$HOME/src/xulsword"
  cd "$HOME/src/xulsword"
  unzip archive.zip
  rm archive.zip
  find . -name "*.pl" -exec chmod ugo+x {} \;
  find . -name "*.sh" -exec chmod ugo+x {} \;
  
  # restore any pre-existing build files
  if [ -e "$HOME/install" ]; then mv "$HOME/install" "$HOME/src/xulsword/Cpp"; fi
  if [ -e "$HOME/build" ];   then mv "$HOME/build"   "$HOME/src/xulsword/Cpp"; fi
fi
XULSWORD=`pwd -P`
echo XULSWORD path is "$XULSWORD"

# XULSWORD_HOST is xulsword on the non-virtual machine (may have custom
# control files etc.)
if [ $MODE -eq "guest" ]; then
  XULSWORD_HOST=/vagrant
else
  XULSWORD_HOST=$XULSWORD
fi

# Create a local installation directory
if [ ! -e "$XULSWORD/Cpp/install" ]; then  mkdir "$XULSWORD/Cpp/install"; fi

# Compile zlib (local compilation is required to create CLucene static library)
# https://packages.ubuntu.com/source/xenial/zlib
if [ ! -e "$XULSWORD/Cpp/zlib" ]; then
  sudo apt-get install -y debhelper binutils gcc-multilib dpkg-dev
  cd "$XULSWORD/Cpp"
  wget http://archive.ubuntu.com/ubuntu/pool/main/z/zlib/zlib_1.2.8.dfsg.orig.tar.gz
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
  sudo apt-get install -y debhelper libboost-dev
  cd "$XULSWORD/Cpp"
  wget http://archive.ubuntu.com/ubuntu/pool/main/c/clucene-core/clucene-core_2.3.3.4.orig.tar.gz
  tar -xf clucene-core_2.3.3.4.orig.tar.gz
  rm clucene-core_2.3.3.4.orig.tar.gz
  mv clucene-core-2.3.3.4 clucene
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
  cmake -G "Unix Makefiles" -D CLUCENE_LIBRARY_DIR="$XULSWORD/Cpp/install/usr/local/lib" -D CLUCENE_LIBRARY="$XULSWORD/Cpp/install/usr/local/lib/libclucene-core.so" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
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
  cmake -G "Unix Makefiles" -D CMAKE_INCLUDE_PATH="$XULSWORD/Cpp/install/usr/local/include" -D CMAKE_LIBRARY_PATH="$XULSWORD/Cpp/install/usr/local/lib" ..
  make
fi

if [ ! -z "$COMPILE_ONLY" ]; then exit; fi

# Download xulrunner
if [ ! -e "$XULSWORD/xulrunner" ]; then
  xulrunnerRev=41.0b9
  cd "$XULSWORD"
  if [ $(uname | grep Darwin) ]; then
    xulrunner=xulrunner-$xulrunnerRev.en-US.mac.tar.bz2
  else
    xulrunner=xulrunner-$xulrunnerRev.en-US.linux-$(uname -p).tar.bz2
  fi
  wget "http://ftp.mozilla.org/pub/mozilla.org/xulrunner/releases/$xulrunnerRev/runtimes/$xulrunner"
  tar -xf $xulrunner
  rm $xulrunner
fi

# Link to EXTRAS if available
if [ -e "$XULSWORD_HOST/$EXTRAS" -a ! -e "$XULSWORD/$EXTRAS" ]; then
  ln -s "$XULSWORD_HOST/$EXTRAS" "$XULSWORD/$EXTRAS"
fi

# Start with a clean build-out if we're virtual
if [ -e /vagrant ]; then
  `rm -rf "$XULSWORD/build-out"`
fi

# Build and compile xulsword
if [ ! -e "$XULSWORD/sword" ]; then mkdir "$XULSWORD/sword"; fi
if [ -e "$XULSWORD/$EXTRAS/loc_MK.txt" ]; then
  "$XULSWORD/$EXTRAS/build_MK.sh"
  cd "$XULSWORD/build"
	"./build.pl" "$XULSWORD/$EXTRAS/loc_MK.txt"
else
  cd "$XULSWORD/build"
	"./build/build.pl"
fi

# Copy build-out result to host if we're running on a VM
if [ -e /vagrant ]; then
  cp -rf "$XULSWORD/build-out" /vagrant
fi

# Start xulsword
# a VM must have firefox installed to run xulsword
if [ -e /vagrant ] && [ ! $(which firefox) ]; then sudo apt-get install -y firefox; fi
if [ -e "$XULSWORD/$EXTRAS/loc_MK.txt" ]; then
  "$XULSWORD/build/run_MK-dev.pl"
else
  "$XULSWORD/build/run_xulsword-dev.pl"
fi
