#!/bin/bash

apt-get update

apt-get install -y libtool
apt-get install -y autoconf
apt-get install -y make
apt-get install -y build-essential
apt-get install -y subversion
apt-get install -y zip

# Get xulsword code
mkdir -p src/xulsword
cd src/xulsword
svn checkout http://xulsword.googlecode.com/svn/trunk/ ./
cd Cpp

# Compile CLucene
wget http://sourceforge.net/projects/clucene/files/clucene-core-stable/0.9.21b/clucene-core-0.9.21b.tar.bz2/download
tar -xf download 
rm download
cd clucene-core-0.9.21b
./configure --disable-multithreading
make install
cd ..

# Compile SWORD engine
mkdir sword-svn
cd sword-svn
svn checkout -r 3008 http://crosswire.org/svn/sword/trunk ./
# fix a SWORD build bug?
perl -p -i -e 's/(PKG_CHECK_MODULES\(\[CLUCENE2\], \[libclucene\-core >= 2.3\],,true\))/\#$1/' ./configure.ac
./autogen.sh
./configure --without-icu
make install

ldconfig

# Prepare for xulsword compilation
cd ..
# fix a SWORD build bug?
perl -p -i -e 's/(PKG_CHECK_MODULES\(\[CLUCENE2\], \[libclucene\-core >= 2.3\],,true\))/\#$1/' ./configure.ac
./autogen.sh
./configure

# Build and compile xulsword
cd ..
find . -name "*.pl" -exec chmod ugo+x {} \;
cd build
./build.pl build_settings.txt

