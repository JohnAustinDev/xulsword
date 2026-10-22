cmake_minimum_required (VERSION 2.8)
project (xulswordProj)

set(xulswordProj_VERSION_MAJOR "$ENV{LIBXULSWORD_MAJOR}")
set(xulswordProj_VERSION_MINOR "$ENV{LIBXULSWORD_MINOR}")
set(xulswordProj_VERSION_REVISION "$ENV{LIBXULSWORD_REVIS}")

set(CMAKE_SKIP_BUILD_RPATH FALSE)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)
set(CMAKE_INSTALL_RPATH "")
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)

IF(APPLE)
  # libc++ is part of every MacOS, so it is linked dynamically. -x strips
  # local symbols at link time, because stripping afterwards would break the
  # linker's ad-hoc code signature on arm64.
  set(CMAKE_SHARED_LINKER_FLAGS "-Wl,-undefined,error -Wl,-x ${CMAKE_SHARED_LINKER_FLAGS}")
ELSE(APPLE)
  # -Wl,--no-undefined flags are required by GCC to make it check shared library dependencies
  set(CMAKE_LINKER_FLAGS "-Wl,-undefined,error -static-libgcc -static-libstdc++ ${CMAKE_SHARED_LINKER_FLAGS}")
  set(CMAKE_SHARED_LINKER_FLAGS "-Wl,-undefined,error -static-libgcc -static-libstdc++ ${CMAKE_SHARED_LINKER_FLAGS}")
ENDIF(APPLE)

# sword does not install all the sword headers, so use the local include dir
include_directories(./src/include ./sword/include ${CMAKE_INCLUDE_PATH})
link_directories(${CMAKE_LIBRARY_PATH})

add_library(xulsword-static SHARED ./src/xulsword.cpp ./src/libxulsword.cpp)

IF(APPLE)
  # The xulsword.node addon finds the dylib next to itself through
  # @rpath (@loader_path). Building with the final install name means the
  # install step never has to modify, and so un-sign, the binary.
  set_target_properties(xulsword-static PROPERTIES
    MACOSX_RPATH ON
    INSTALL_NAME_DIR "@rpath"
    BUILD_WITH_INSTALL_NAME_DIR TRUE
    BUILD_WITH_INSTALL_RPATH TRUE)
ENDIF(APPLE)

# set this so swmodule.cpp will allow CLucene searching
add_definitions(-DUSELUCENE)

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
ELSEIF(APPLE)
  # Apple linkers have no -Bstatic, so CMake would turn libz.a into -lz, which
  # links libz.dylib instead. Use full paths to link the static libraries.
  target_link_libraries (xulsword-static ${CMAKE_LIBRARY_PATH}/libsword.a ${CMAKE_LIBRARY_PATH}/libclucene-core-static.a ${CMAKE_LIBRARY_PATH}/libclucene-shared-static.a ${CMAKE_LIBRARY_PATH}/libz.a)
ELSE(CMAKE_TOOLCHAIN_FILE MATCHES "windows")
  target_link_libraries (xulsword-static libsword.a libclucene-core-static.a libclucene-shared-static.a libz.a)
ENDIF(CMAKE_TOOLCHAIN_FILE MATCHES "windows")

install(TARGETS xulsword-static DESTINATION "${LIB_INSTALL_DIR}")
