# CMake toolchain for cross-compiling to MacOS from Linux using clang, lld
# and the LLVM tools, plus a MacOS SDK (see Cpp/libxulsword-build.sh). One
# architecture is built per CMake run, selected by the MACARCH environment
# variable (arm64 or x86_64). libxulsword-build.sh merges the architectures
# into universal binaries later.

set(CMAKE_SYSTEM_NAME Darwin)
# Darwin 20 is MacOS 11
set(CMAKE_SYSTEM_VERSION 20)

if(NOT DEFINED ENV{MACARCH})
  message(FATAL_ERROR "Set MACARCH to arm64 or x86_64 before running cmake.")
endif()
set(MACARCH $ENV{MACARCH})
set(CMAKE_SYSTEM_PROCESSOR ${MACARCH})
set(CMAKE_OSX_ARCHITECTURES ${MACARCH} CACHE STRING "")
set(CMAKE_OSX_DEPLOYMENT_TARGET $ENV{MACOS_DEPLOYMENT_TARGET} CACHE STRING "")
set(CMAKE_OSX_SYSROOT $ENV{CPP}/$ENV{MACOS_SDK} CACHE PATH "")

if(DEFINED ENV{LLVM_BIN})
  set(LLVM_BIN $ENV{LLVM_BIN})
else()
  execute_process(COMMAND llvm-config --bindir
    OUTPUT_VARIABLE LLVM_BIN OUTPUT_STRIP_TRAILING_WHITESPACE)
endif()

set(MACTARGET ${MACARCH}-apple-macos$ENV{MACOS_DEPLOYMENT_TARGET})
set(CMAKE_C_COMPILER ${LLVM_BIN}/clang)
set(CMAKE_CXX_COMPILER ${LLVM_BIN}/clang++)
set(CMAKE_C_COMPILER_TARGET ${MACTARGET})
set(CMAKE_CXX_COMPILER_TARGET ${MACTARGET})

set(CMAKE_AR ${LLVM_BIN}/llvm-ar CACHE FILEPATH "")
set(CMAKE_RANLIB ${LLVM_BIN}/llvm-ranlib CACHE FILEPATH "")
set(CMAKE_NM ${LLVM_BIN}/llvm-nm CACHE FILEPATH "")
set(CMAKE_STRIP ${LLVM_BIN}/llvm-strip CACHE FILEPATH "")
set(CMAKE_LIPO ${LLVM_BIN}/llvm-lipo CACHE FILEPATH "")
set(CMAKE_OTOOL ${LLVM_BIN}/llvm-otool CACHE FILEPATH "")
set(CMAKE_INSTALL_NAME_TOOL ${LLVM_BIN}/llvm-install-name-tool CACHE FILEPATH "")

# Link with lld's Mach-O linker (ld64.lld). It ad-hoc signs arm64 output,
# which MacOS requires before arm64 code can run. -fuse-ld=lld (rather than
# --ld-path) lets clang know it is lld, so it passes -platform_version.
set(LDFLAGS "-fuse-ld=lld")
set(CMAKE_EXE_LINKER_FLAGS_INIT ${LDFLAGS})
set(CMAKE_SHARED_LINKER_FLAGS_INIT ${LDFLAGS})
set(CMAKE_MODULE_LINKER_FLAGS_INIT ${LDFLAGS})

# CLucene's old code (register, std::binary_function) does not compile as
# C++17 with clang and libc++, and nothing here needs C++17. CLucene also
# narrows constants in initializer lists, which clang treats as an error
# (GCC only warns).
set(CMAKE_CXX_FLAGS_INIT "-std=gnu++14 -Wno-deprecated-declarations -Wno-c++11-narrowing")

# Search for headers and libraries in the SDK, and for programs on the host.
set(CMAKE_FIND_ROOT_PATH ${CMAKE_OSX_SYSROOT})
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
