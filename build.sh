#!/bin/bash

sudo apt-get update

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

# Compile CLucene (using pre-existing code if it exists)
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

# Compile SWORD engine (using pre-existing code if it exists)
if [ ! -e ./sword-svn ]; then
	mkdir sword-svn
	cd sword-svn
	svn checkout -r 3008 http://crosswire.org/svn/sword/trunk ./
	cd ..
fi
cd sword-svn
make clean
./autogen.sh
./configure --without-icu
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

