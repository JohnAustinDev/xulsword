#!/bin/bash

# This script can be run on any linux, OSX or vagrant machine. It
# installs any necessary dependencies and builds xulsword using the
# loc_MK.txt build settings if this file exists (otherwise defaults).

cd `dirname $0`

EXTRAS=IBTXulsword

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
  sudo apt-get install -y build-essential git subversion libtool-bin autoconf make pkg-config zip
  # install packages for sword
  sudo apt-get install -y zlib1g-dev libclucene-dev 
  # libboost-dev ?
  if [[ "$(uname -p)" == "i686" ]]; then
    # the 32-bit libclucene is installed in an unexpected place for sword-svn, so fix it
    sudo ln -s /usr/lib/i386-linux-gnu/libclucene-core.so /usr/lib/libclucene-core.so
  fi
  # fix bugs in clucene
  #sudo sed -i -e 's/#include "CLucene\/clucene-config.h"/#include "CLucene\/CLConfig.h"/' /usr/include/CLucene/SharedHeader.h
  #sudo sed -i -e 's/#if defined(_CL_DISABLE_MULTITHREADING)/#if defined(_CL_DISABLE_MULTITHREADING)\n#define _LUCENE_ATOMIC_INT_GET(x) x\n#define _LUCENE_ATOMIC_INT_SET(x,v) x=v\n/' /usr/include/CLucene/LuceneThreads.h
    
  #sudo apt-get install -y firefox
fi

# If this is Vagrant, then copy xulsword code locally so as not to 
# disturb any build files on the host machine!
if [ -e /vagrant ]; then
  if [ -e $HOME/xulsword ]; then
    rm -rf $HOME/xulsword
  fi
  mkdir $HOME/xulsword
  
  cd /vagrant
  git config --global user.email "vagrant@vm.net"
  git config --global user.name "Vagrant User"
  stash=`git stash create`
  if [ ! $stash ]; then stash=`git rev-parse HEAD`; fi
  git archive -o archive.zip $stash
  mv archive.zip $HOME/xulsword
  cd $HOME/xulsword
  unzip archive.zip
  rm archive.zip
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

cd $XULSWORD
find . -name "*.pl" -exec chmod ugo+x {} \;
find . -name "*.sh" -exec chmod ugo+x {} \;

# COMPILE SWORD ENGINE DEPENDENCIES
# CLucene
if [ $(uname | grep Darwin) ] && [ ! -e "$XULSWORD/Cpp/clucene-core-0.9.21b" ]; then
  # Patch a problem with MAC compile of clucene
  echo Compiling $XULSWORD/Cpp/clucene-core-0.9.21b
  cd "$XULSWORD/Cpp"
  wget http://sourceforge.net/projects/clucene/files/clucene-core-stable/0.9.21b/clucene-core-0.9.21b.tar.bz2/download
  tar -xf download 
  rm download
  cd "$XULSWORD/Cpp/clucene-core-0.9.21b"
  cp -f ../cluceneMK/osx/repl_tchar.h ./src/CLucene/config
  make clean
  ./configure --disable-multithreading
  make
  sudo make install
  sudo ldconfig
fi

# Compile the SWORD engine (at specific rev)
# 3563 is sword-1.8.1
swordRev=3563
if [ ! -e "$XULSWORD/Cpp/sword-svn" ]; then
  cd "$XULSWORD/Cpp"
  svn checkout -r $swordRev http://crosswire.org/svn/sword/trunk sword-svn
  cd sword-svn
  if [ $(uname | grep Darwin) ]; then
    # use brew's glibtoolize instead of libtoolize
    perl -p -i -e 's/^(LTIZE="\$AUTODIR"")(libtoolize")/$1g$2/' ./autogen.sh
  fi
  ./autogen.sh
  ./configure CLUCENE2_CFLAGS="-D_CL_DISABLE_MULTITHREADING"
  #sudo cp ./config.h /usr/include/CLucene/clucene-config.h
  make
  sudo make install
  sudo ldconfig
fi

exit

# Download xulrunner (unless it exists already)
xulrunnerRev=41.0b9
if [ ! -e "$XULSWORD/xulrunner" ]; then
  cd "$XULSWORD"
  if [ $(uname | grep Darwin) ]; then
    xulrunner=xulrunner-$xulrunnerRev.en-US.mac.tar.bz2
  else
    if [[ "$(uname -p)" == "i686" ]]; then
      xulrunner=xulrunner-$xulrunnerRev.en-US.linux-i686.tar.bz2
    else
      xulrunner=xulrunner-$xulrunnerRev.en-US.linux-x86_64.tar.bz2
    fi
  fi
  wget http://ftp.mozilla.org/pub/mozilla.org/xulrunner/releases/$xulrunnerRev/runtimes/$xulrunner
  tar -xf $xulrunner
  rm $xulrunner
fi

# Configure xulsword
cd "$XULSWORD/Cpp"
make clean
if [ $(uname | grep Darwin) ]; then
  # patch untgz MAC compile problem
  perl -p -i -e 's/#ifdef unix/#if defined(unix) || defined(__APPLE__)/g' ./sword-svn/src/utilfuns/zlib/untgz.c
fi
./autogen.sh
./configure

if [ ! -e $XULSWORD/sword ]; then
  mkdir "$XULSWORD/sword"
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

# Copy virtual build-out to host if we're running virtual
if [ -e /vagrant ]; then
  `cp -r "$XULSWORD/build-out" /vagrant`
  # Fix permissions in Vagrant
  chown -R vagrant:vagrant $HOME
fi
