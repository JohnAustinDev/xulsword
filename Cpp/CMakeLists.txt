cmake_minimum_required (VERSION 2.8)
project (xulswordProj)

set(xulswordProj_VERSION_MAJOR "1")
set(xulswordProj_VERSION_MINOR "4")
set(xulswordProj_VERSION_REVISION "4")

set(CMAKE_SKIP_BUILD_RPATH FALSE)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)
set(CMAKE_INSTALL_RPATH "")
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)

# -Wl,--no-undefined flags are required by GCC to make it check shared library dependencies
set(CMAKE_CXX_FLAGS "-pthread ${CMAKE_CXX_FLAGS}")
set(CMAKE_LINKER_FLAGS "-Wl,-undefined,error ${CMAKE_SHARED_LINKER_FLAGS}")
set(CMAKE_SHARED_LINKER_FLAGS "-Wl,-undefined,error ${CMAKE_SHARED_LINKER_FLAGS}")

# sword does not install all the sword headers, so use the local include dir
include_directories(./src/include ./sword/include ${CMAKE_INCLUDE_PATH})
link_directories(${CMAKE_LIBRARY_PATH})

add_library(xulsword SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)
set_target_properties(xulsword PROPERTIES VERSION 1.4.4)
target_link_libraries (xulsword sword clucene-core clucene-shared zlib)

#add_library(xulsword-static SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)
#set_target_properties(xulsword-static PROPERTIES VERSION 1.4.4)
#target_link_libraries(xulsword-static libsword.a)
#target_link_libraries(xulsword-static libclucene-shared.a)
#target_link_libraries(xulsword-static libclucene-core.a)

# For Linux cross-compilation to Windows
IF(CMAKE_TOOLCHAIN_FILE MATCHES "cmake-toolchain.64win")
  add_definitions(-DWIN32 -D_WIN32)
  # _ASCII is a CLucene define needed for headers to compile
  add_definitions(-D_ASCII)
  set(CMAKE_CXX_FLAGS "-fpermissive ${CMAKE_CXX_FLAGS}")
ENDIF(CMAKE_TOOLCHAIN_FILE MATCHES "cmake-toolchain.64win")
