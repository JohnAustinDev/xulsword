cmake_minimum_required (VERSION 2.8)
project (xulswordProj)

set(xulswordProj_VERSION_MAJOR "$ENV{LIBXULSWORD_MAJOR}")
set(xulswordProj_VERSION_MINOR "$ENV{LIBXULSWORD_MINOR}")
set(xulswordProj_VERSION_REVISION "$ENV{LIBXULSWORD_REVIS}")

set(CMAKE_SKIP_BUILD_RPATH FALSE)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)
set(CMAKE_INSTALL_RPATH "")
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)

# -Wl,--no-undefined flags are required by GCC to make it check shared library dependencies
set(CMAKE_LINKER_FLAGS "-Wl,-undefined,error ${CMAKE_SHARED_LINKER_FLAGS}")
set(CMAKE_SHARED_LINKER_FLAGS "-Wl,-undefined,error ${CMAKE_SHARED_LINKER_FLAGS}")

# sword does not install all the sword headers, so use the local include dir
include_directories(./src/include ./sword/include ${CMAKE_INCLUDE_PATH})
link_directories(${CMAKE_LIBRARY_PATH})

add_library(xulsword-static SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)

# For Linux cross-compilation to Windows
IF(CMAKE_TOOLCHAIN_FILE MATCHES "windows")
  # Use same CLucene compilation flags and definitions:
  set(CMAKE_CXX_FLAGS "-fvisibility=hidden -fvisibility-inlines-hidden -O2 -g -DNDEBUG -D_REENTRANT -D_UCS2 -D_UNICODE ${CMAKE_CXX_FLAGS}")
  add_definitions(-DWIN32 -D_WIN32 -DBUILDING_LIBRARY)
  # Windows requires that the type of import target library (dll or a) be
  # decided by headers. CLucene shared headers require the definition of
  # MAKE_CLUCENE_XX_LIB to allow import from an .a type library.
  target_compile_definitions(xulsword-static PUBLIC -DMAKE_CLUCENE_CORE_LIB -DMAKE_CLUCENE_SHARED_LIB)

  target_link_libraries (xulsword-static libsword.a libclucene-core-static.a libclucene-shared-static.a zlibstatic.a)
ELSE(CMAKE_TOOLCHAIN_FILE MATCHES "windows")
  target_link_libraries (xulsword-static libsword.a libclucene-core-static.a libclucene-shared-static.a libz.a)
ENDIF(CMAKE_TOOLCHAIN_FILE MATCHES "windows")

set_target_properties(xulsword-static PROPERTIES VERSION "${xulswordProj_VERSION_MAJOR}.${xulswordProj_VERSION_MINOR}.${xulswordProj_VERSION_REVISION}")

install(TARGETS xulsword-static DESTINATION "${LIB_INSTALL_DIR}")
