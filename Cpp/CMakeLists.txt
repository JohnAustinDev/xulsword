cmake_minimum_required (VERSION 2.8)
project (xulswordProj)

set(xulswordProj_VERSION_MAJOR "1")
set(xulswordProj_VERSION_MINOR "4")
set(xulswordProj_VERSION_REVISION "4")

# -Wl,--no-undefined flags are required by GCC to make it check shared library dependencies
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wl,--no-undefined")

# sword does not install all the sword headers, so use the local include dir
include_directories(./src/include ./sword/include  ${CMAKE_INCLUDE_PATH})
link_directories(${CMAKE_LIBRARY_PATH})

add_library(xulsword SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)
set_target_properties(xulsword PROPERTIES VERSION 1.4.4)
target_link_libraries (xulsword sword clucene-core clucene-shared z)

add_library(xulsword-static SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)
set_target_properties(xulsword-static PROPERTIES VERSION 1.4.4)
# libz is required by GCC because the static libz.a causes -fPIC errors even when libz is compiled with -fPIC
# pthread is required by GCC because a clucene bug with its DISABLE_MULTITHREADING feature causes it to fail compilation
target_link_libraries (xulsword-static z pthread libsword.a libclucene-core-static.a libclucene-shared-static.a)
