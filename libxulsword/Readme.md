# The XulSword Library Node.js Addon

This Node.js addon provides a JavaScript interface to the libxulsword dynamic library. The libxulsword dynamic library (.so, .dll or .dylib) should be constructed prior to building this addon.

# Linux Build

 Run `Cpp/docker-build.sh`, or `Cpp/libxulsword-build.sh` if you're on Ubuntu 24. The libxulsword.node addon is built from the libxulsword directory by running `yarn` followed by `yarn rebuild`. The electron_rebuild module is responsible for compiling against the selected version of Electron.

# Windows Build

Both the libxulsword-static.dll shared library and this addon may be cross-compiled on Linux by `Cpp/libxulsword-build.sh`, using MinGW-w64. Set `WINMACHINE` in `setenv` to `x86` (32 bit) or `x64` (64 bit), then run `Cpp/docker-build.sh` or `Cpp/libxulsword-build.sh` if you're on Ubuntu 24. The DLL and the MinGW runtime DLLs go to `Cpp/lib.32win` or `Cpp/lib.64win`, and `install.mjs` copies them next to `libxulsword.node`. The addon goes to `bin/win32-ia32-89` or `bin/win32-x64-89`, which is kept under version control like the other binaries.

Because node-gyp cannot cross-compile, libxulsword-build.sh compiles `src/libxulsword.cpp` itself. The addon calls Node-API functions that are exported by the program that loads it: node.exe, electron.exe or the packaged app's executable. Windows must know which program at link time, so, as node-gyp does, the addon delay-loads the functions from `node.exe`, and `src/win_delay_load_hook.c` makes Windows take them from the running program instead. The import library for `node.exe` is made from the `.def` file in the [node-api-headers](https://github.com/nodejs/node-api-headers) package. The addon is linked with LLVM's lld, because GNU ld does not make working delay-load imports.

# MacOS Build

Both the libxulsword-static.dylib shared library and this addon are cross-compiled on Linux by `Cpp/libxulsword-build.sh`, using clang, lld and a MacOS SDK. Each is built for arm64 and x86_64, and the two are merged into universal binaries. Because node-gyp cannot cross-compile, libxulsword-build.sh compiles `src/libxulsword.cpp` itself and writes the result to `bin/darwin-universal-89/libxulsword.node`, which is kept under version control like the other libxulsword.node binaries.

1. Supply the MacOS SDK, which Apple does not allow to be downloaded automatically. Use one of the [osxcross](https://github.com/tpoechtrager/osxcross) scripts to make `MacOSX<version>.sdk.tar.xz`, then place it in `xulsword/archive`:
   - On Linux: download an Xcode .xip from https://developer.apple.com/download/all/ (Xcode 15.4 contains MacOSX14.5.sdk) and run `tools/gen_sdk_package_pbzx.sh <xcode>.xip`.
   - On a Mac with Xcode or its Command Line Tools: run `tools/gen_sdk_package.sh`.
2. In `xulsword/setenv`, set `MACMACHINE=universal`. If your SDK is not MacOSX14.5.sdk, also set `MACOS_SDK` to match.
3. Run `Cpp/docker-build.sh`, or `Cpp/libxulsword-build.sh` if you're on Ubuntu 24. The universal dylib goes to `Cpp/lib.darwin`, and `install.mjs` copies it next to `libxulsword.node`, which finds it through `@loader_path`.
4. Run `yarn package-mac` to make two MacOS app zips in `build/release`: one for Intel Macs (`-mac.zip`) and one for Apple Silicon Macs (`-arm64-mac.zip`). A single universal app, or a DMG, can only be made on a Mac. The apps are signed with [rcodesign](https://github.com/indygreg/apple-platform-rs), which `scripts/macSign.mjs` downloads to `Cpp/darwin-bin` the first time.

# TODOs

Rework to utilize the `ObjectWrap` implementation of the libxulsword interface
