# The XulSword Library Node.js Addon

This Node.js addon provides a JavaScript interface to the libxulsword dynamic library (.so, .dll or .dylib).

The dynamic library and this addon are both built by `Cpp/docker-build.sh`, or `Cpp/libxulsword-build.sh` if you're on Ubuntu 24. All the binaries for each system go to one directory:

- Linux: `Cpp/lib`
- Windows: `Cpp/lib.32win` or `Cpp/lib.64win` (including the MinGW runtime DLLs)
- MacOS: `Cpp/lib.darwin`

`yarn install-libxulsword` copies the binaries for a system into `libxulsword/build/Release`.

The addon is built by libxulsword-build.sh rather than node-gyp, because node-gyp cannot cross-compile. The addon only uses Node-API, so it works with any version of Node.js or Electron, and does not need to be rebuilt when Electron is updated.

# Windows Build

The Windows binaries are cross-compiled on Linux using MinGW-w64. Set `WINMACHINE` in `setenv` to `x86` (32 bit) or `x64` (64 bit) before building.

The addon calls Node-API functions that are exported by the program that loads it: node.exe, electron.exe or the packaged app's executable. Windows must know which program at link time, so, as node-gyp does, the addon delay-loads the functions from `node.exe`, and `src/win_delay_load_hook.c` makes Windows take them from the running program instead. The import library for `node.exe` is made from the `.def` file in the [node-api-headers](https://github.com/nodejs/node-api-headers) package. The addon is linked with LLVM's lld, because GNU ld does not make working delay-load imports.

# MacOS Build

The MacOS binaries are cross-compiled on Linux using clang, lld and a MacOS SDK. Each is built for arm64 and x86_64, and the two are merged into universal binaries. The addon finds the dylib through `@loader_path`, so they are installed side by side.

1. Supply the MacOS SDK, which Apple does not allow to be downloaded automatically. Use one of the [osxcross](https://github.com/tpoechtrager/osxcross) scripts to make `MacOSX<version>.sdk.tar.xz`, then place it in `xulsword/archive`:
   - On Linux: download an Xcode .xip from https://developer.apple.com/download/all/ (Xcode 15.4 contains MacOSX14.5.sdk) and run `tools/gen_sdk_package_pbzx.sh <xcode>.xip`.
   - On a Mac with Xcode or its Command Line Tools: run `tools/gen_sdk_package.sh`.
2. In `xulsword/setenv`, set `MACMACHINE=universal`. If your SDK is not MacOSX14.5.sdk, also set `MACOS_SDK` to match.

# TODOs

Rework to utilize the `ObjectWrap` implementation of the libxulsword interface
