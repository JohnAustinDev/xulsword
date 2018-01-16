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
  # install and configure packages for sword
  sudo apt-get install -y zlib1g-dev libclucene-dev
  sudo ln -s "$HOME/src/xulsword/Cpp/cluceneMK/include/Linux/clucene-config.h" "/usr/include/CLucene/clucene-config.h"
  
  #sudo apt-get install -y firefox
fi

git config --global user.email "vm@vagrant.net"
git config --global user.name "Vagrant User"

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

# Compile CLucene (needed for static lib)
# Compile the SWORD engine (needed for static lib)
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
  ./configure
  make
  sudo make install
  sudo ldconfig
fi

# Download xulrunner (unless it exists already)
xulrunnerRev=41.0b9
if [ ! -e "$XULSWORD/xulrunner" ]; then
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
