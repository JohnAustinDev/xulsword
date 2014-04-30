#!/bin/bash

find . -name "*.pl" -exec chmod ugo+x {} \;

sudo apt-get update

# [ ! -e ./Cpp ] means running in Vagrant
if [ ! -e ./Cpp ]; then 
	noprompt="-y"
fi 

sudo apt-get install $noprompt libtool
sudo apt-get install $noprompt autoconf
sudo apt-get install $noprompt make
sudo apt-get install $noprompt pkg-config
sudo apt-get install $noprompt build-essential
sudo apt-get install $noprompt subversion
sudo apt-get install $noprompt zip

# Find our Cpp directory
if [ -e ./Cpp ]; then
	cd Cpp 
else
	cd /vagrant/Cpp
fi

# Compile CLucene
if [ ! -e ./clucene-core-0.9.21b ]; then
	wget http://sourceforge.net/projects/clucene/files/clucene-core-stable/0.9.21b/clucene-core-0.9.21b.tar.bz2/download
	tar -xf download 
	rm download
fi
cd clucene-core-0.9.21b
make clean
./configure --disable-multithreading
make
sudo make install
sudo ldconfig
cd ..

: <<'COMMENT'
# Compile XZ Utils
if [ ! -e ./xz-5.0.5 ]; then
	wget http://tukaani.org/xz/xz-5.0.5.tar.bz2
	tar -xf xz-5.0.5.tar.bz2 
	rm xz-5.0.5.tar.bz2
fi
cd xz-5.0.5
make clean
./configure
make
sudo make install
sudo ldconfig
cd ..

# Compile bzip2
if [ ! -e ./clucene-core-0.9.21b ]; then
	wget http://www.bzip.org/1.0.6/bzip2-1.0.6.tar.gz
	tar -xf bzip2-1.0.6.tar.gz 
	rm bzip2-1.0.6.tar.gz
fi
cd bzip2-1.0.6
make clean
make
sudo make install
sudo ldconfig
cd ..
COMMENT

# Compile SWORD engine
swordRev=3203
if [ ! -e ./sword-svn ]; then
	mkdir sword-svn
	cd sword-svn
	svn checkout -r $swordRev http://crosswire.org/svn/sword/trunk ./
	cd ..
else
  cd sword-svn
  svn update -r $swordRev
  cd ..
fi
cd sword-svn
make clean
./autogen.sh
./configure --without-icu --without-xz --without-bzip2
make
sudo make install
sudo ldconfig

# Configure xulsword
cd ..
make clean
./autogen.sh
./configure

# Build and compile xulsword
cd ../build
if [ -e loc_vagrant.txt ]; then
	./build.pl loc_vagrant.txt
else 
	./build.pl build_settings.txt
fi

