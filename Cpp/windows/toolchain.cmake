set(CMAKE_SYSTEM_NAME Windows)

IF($ENV{TOOLCHAIN_PREFIX} STREQUAL "x86_64-w64-mingw32")

  set(TOOLCHAIN_PREFIX x86_64-w64-mingw32)
  
ENDIF($ENV{TOOLCHAIN_PREFIX} STREQUAL "x86_64-w64-mingw32")

IF($ENV{TOOLCHAIN_PREFIX} STREQUAL "i686-w64-mingw32")

  set(TOOLCHAIN_PREFIX i686-w64-mingw32)
  
ENDIF($ENV{TOOLCHAIN_PREFIX} STREQUAL "i686-w64-mingw32")

# cross compilers to use for C and C++
IF($ENV{GCCSTD} STREQUAL "win32")

  set(CMAKE_C_COMPILER ${TOOLCHAIN_PREFIX}-gcc)
  set(CMAKE_CXX_COMPILER ${TOOLCHAIN_PREFIX}-g++)
  set(CMAKE_FIND_ROOT_PATH /usr/${TOOLCHAIN_PREFIX} /usr/lib/gcc/${TOOLCHAIN_PREFIX}/9.3-win32)
  
ENDIF($ENV{GCCSTD} STREQUAL "win32")

IF($ENV{GCCSTD} STREQUAL "posix")

  set(CMAKE_C_COMPILER ${TOOLCHAIN_PREFIX}-gcc-posix)
  set(CMAKE_CXX_COMPILER ${TOOLCHAIN_PREFIX}-g++-posix)
  set(CMAKE_FIND_ROOT_PATH /usr/${TOOLCHAIN_PREFIX} /usr/lib/gcc/${TOOLCHAIN_PREFIX}/9.3-posix)
  
ENDIF($ENV{GCCSTD} STREQUAL "posix")

set(CMAKE_RC_COMPILER ${TOOLCHAIN_PREFIX}-windres)

# modify default behavior of FIND_XXX() commands to
# search for headers/libs in the target environment and
# search for programs in the build host environment
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)

# Needed by Clucene
set(CMAKE_CXX_FLAGS "-Wno-narrowing -fpermissive")
