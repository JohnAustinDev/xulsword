cmake_minimum_required (VERSION 3.5)
project (xulswordProj)

set(xulswordProj_VERSION_MAJOR "1")
set(xulswordProj_VERSION_MINOR "4")
set(xulswordProj_VERSION_REVISION "4")

# -Wl,--no-undefined flags are required by GCC to make it check shared library dependencies
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wl,--no-undefined -DNOSECURITY")

# /usr/local/include/sword does not have all the sword headers, so use local include dir instead
include_directories(./src/include ./sword/include)
link_directories(/usr/local/lib)

add_library(xulsword SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)
set_target_properties(xulsword PROPERTIES VERSION 1.4.4)
target_link_libraries (xulsword sword clucene-core clucene-shared z)

add_library(xulsword-static SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)
set_target_properties(xulsword-static PROPERTIES VERSION 1.4.4)
# libz is required by GCC because the static libz.a causes -fPIC errors even when libz is compiled with -fPIC
# pthread is required by GCC because a clucene bug with its DISABLE_MULTITHREADING feature causes it to fail compilation
target_link_libraries (xulsword-static z pthread /usr/local/lib/libsword.a /usr/local/lib/libclucene-core-static.a /usr/local/lib/libclucene-shared-static.a)
