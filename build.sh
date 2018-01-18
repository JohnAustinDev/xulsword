#!/bin/bash

# This script should NOT be run as root (privileged: false in Vagrantfile)

# This script can be run on a linux, OSX or vagrant machine. It
# installs any necessary dependencies and builds xulsword using the
# loc_MK.txt build settings if this file exists (otherwise defaults).

cd `dirname $0`

EXTRAS=IBTXulsword

if [ ! -e "$XULSWORD/Cpp/build" ]; then
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

# If this is Vagrant, then copy xulsword code locally so as not to 
# disturb any build files on the host machine!
if [ -e /vagrant ]; then
  if [ -e $HOME/src/xulsword ]; then
    rm -rf $HOME/src/xulsword
  fi
  mkdir -p $HOME/src/xulsword
  cd /vagrant
  stash=`git stash create`
  if [ ! $stash ]; then stash=`git rev-parse HEAD`; fi
  git archive -o archive.zip $stash
  mv archive.zip $HOME/src/xulsword
  cd $HOME/src/xulsword
  unzip archive.zip
  rm archive.zip
  find . -name "*.pl" -exec chmod ugo+x {} \;
  find . -name "*.sh" -exec chmod ugo+x {} \;
fi
XULSWORD=`pwd -P`
echo XULSWORD path is "$XULSWORD"

# XULSWORD_HOST is xulsword on the non-virtual machine (may have custom
# control files etc.)
if [ -e /vagrant ]; then
  XULSWORD_HOST=/vagrant
else
  XULSWORD_HOST=$XULSWORD
fi

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
  cmake -G "Unix Makefiles" ..
  make
  sudo make install
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
  # -D DISABLE_MULTITHREADING=ON always causes compilation to fail, os it is not used
  cmake -G "Unix Makefiles" -D BUILD_STATIC_LIBRARIES=1 -D ZLIB_INCLUDE_DIR=$HOME/src/Cpp/zlib ..
  make
  sudo make install
fi

# Compile libsword (local compilation is required to create libxulsword static library)
if [ ! -e "$XULSWORD/Cpp/sword" ]; then
  # svn rev 3563 is sword-1.8.1
  swordRev=3563
  cd "$XULSWORD/Cpp"
  svn checkout -r $swordRev http://crosswire.org/svn/sword/trunk sword
  mkdir ./sword/build
  cd ./sword/build
  cmake -G "Unix Makefiles" ..
  make
  sudo make install
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
  cmake -G "Unix Makefiles" ..
  make
fi

if [ ! -e $XULSWORD/sword ]; then
  mkdir "$XULSWORD/sword"
fi

# Download xulrunner
if [ ! -e "$XULSWORD/xulrunner" ]; then
  xulrunnerRev=41.0b9
  cd "$XULSWORD"
  if [ $(uname | grep Darwin) ]; then
    xulrunner=xulrunner-$xulrunnerRev.en-US.mac.tar.bz2
  else
    xulrunner=xulrunner-$xulrunnerRev.en-US.linux-$(uname -p).tar.bz2
  fi
  wget http://ftp.mozilla.org/pub/mozilla.org/xulrunner/releases/$xulrunnerRev/runtimes/$xulrunner
  tar -xf $xulrunner
  rm $xulrunner
fi

# Link to EXTRAS if available
if [ -e "$XULSWORD_HOST/$EXTRAS" -a ! -e "$XULSWORD/$EXTRAS" ]; then
  sudo ln -s "$XULSWORD_HOST/$EXTRAS" "$XULSWORD/$EXTRAS"
fi

# Start with a clean build-out if we're virtual
if [ -e /vagrant ]; then
  `rm -rf "$XULSWORD/build-out"`
fi

# Build and compile xulsword
if [ -e "$XULSWORD/$EXTRAS/loc_MK.txt" ]; then
  "$XULSWORD/$EXTRAS/build_MK.sh"
	"$XULSWORD/build/build.pl" "$XULSWORD/$EXTRAS/loc_MK.txt"
else 
	"$XULSWORD/build/build.pl"
fi

# Copy build-out result to host if we're running on a VM
if [ -e /vagrant ]; then
  cp -rf "$XULSWORD/build-out" /vagrant
fi

# Start xulsword
# a VM must have firefox installed to run xulsword
if [ -e /vagrant ] && [ ! $(which firefox) ]; then sudo apt-get install -y firefox; fi
if [ -e "$XULSWORD/$EXTRAS/loc_MK.txt" ]; then
  $HOME/src/xulsword/build/run_MK-dev.pl
else
  $HOME/src/xulsword/build/run_xulsword-dev.pl
fi
