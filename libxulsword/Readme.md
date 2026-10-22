# The XulSword Library Node.js Addon

This Node.js addon provides a JavaScript interface to the libxulsword dynamic library. The libxulsword dynamic library (.so, .dll or .dylib) should be constructed prior to building this addon.

# Linux Build

In Linux, the build depends on libxulsword.so as well as shell tools and environment variables that must be set for each shell. All of this is done by running `source ./init.sh` from the xulsword project directory. Then the native libxulsword addon will be built from the libxulsword directory with `yarn` followed by `yarn rebuild`. The electron_rebuild module is responsible for compiling against the selected version of Electron.

# Windows Build

Although the libxulsword.dll shared library is cross-compiled with MinGW, this node addon cannot be cross-compiled because node-gyp is not compatible with MinGW. This addon must be compiled with MSVC for Windows. However, since it uses node-addon-api, it does not need to be recompiled unless the libxulsword.dll interface changes. For this reason, the MS-Windows libxulsword.node compiled binary is kept under version control. Compilation of this binary does not require the libxulsword.dll, but just a libxulsword.def file. This def file is created by init.sh, and it only changes when libxulsword.dll exported symbols change. When I compiled this addon in MS-Windows, I used nvm from https://github.com/coreybutler/nvm-windows.

1. From an admistrator priviledged cmd.exe, the node version and arch to link against must first be selected (ie. `nvm use 18.12.1 32`).
2. From a non-priviledged cmd.exe shell, run either MSVC's `vcvars32.bat` or `vcvars64.bat` (the one corresponding to the selected node arch).
3. Run Git/bin/bash.exe from the cmd shell to start a git-bash shell in the new environment.
4. cd into xulsword and update the setenv file so that WINMACHINE=x64 or x86 (whichever corresponds to your chosen node arch).
5. Run `source ./setenv` to complete the environment settings.
6. Build libxulsword by changing to the libxulsword directory and running `yarn` then `yarn rebuild`.
7. Commit the resulting lib/$(XCWD)/libxulsword.node binary to version control.

# MacOS Build

Both the libxulsword-static.dylib shared library and this addon are cross-compiled on Linux by init.sh, using clang, lld and a MacOS SDK. Each is built for arm64 and x86_64, and the two are merged into universal binaries. Because node-gyp cannot cross-compile, init.sh compiles `src/libxulsword.cpp` itself and writes the result to `bin/darwin-universal-89/libxulsword.node`, which is kept under version control like the other binaries.

1. Install the build tools: `sudo apt-get install clang lld llvm xz-utils`.
2. Supply the MacOS SDK, which Apple does not allow to be downloaded automatically. Use one of the [osxcross](https://github.com/tpoechtrager/osxcross) scripts to make `MacOSX<version>.sdk.tar.xz`, then place it in `xulsword/archive`:
   - On Linux: download an Xcode .xip from https://developer.apple.com/download/all/ (Xcode 15.4 contains MacOSX14.5.sdk) and run `tools/gen_sdk_package_pbzx.sh <xcode>.xip`.
   - On a Mac with Xcode or its Command Line Tools: run `tools/gen_sdk_package.sh`.
3. In `xulsword/setenv`, set `MACMACHINE=universal`. If your SDK is not MacOSX14.5.sdk, also set `MACOS_SDK` to match.
4. Run `./init.sh`. The universal dylib goes to `Cpp/lib.darwin`, and `install.mjs` copies it next to `xulsword.node`, which finds it through `@loader_path`.
5. Run `yarn package-mac` to make two MacOS app zips in `build/release`: one for Intel Macs (`-mac.zip`) and one for Apple Silicon Macs (`-arm64-mac.zip`). A single universal app, or a DMG, can only be made on a Mac.

## Signing and notarizing on Linux

electron-builder only signs MacOS apps when it runs on MacOS. On Linux, `afterPack.mjs` signs the app with [rcodesign](https://gregoryszorc.com/docs/apple-codesign/main/), which init.sh installs to `Cpp/darwin-bin`.

- With no credentials, the app is ad-hoc signed. It will run on any Mac, but Gatekeeper blocks it the first time, so users must right-click it and choose Open (or run `xattr -cr MK.app`).
- To sign with a Developer ID, which requires Apple Developer Program membership, set `MAC_SIGN_P12` and `MAC_SIGN_P12_PASSWORD_FILE` in setenv. The .p12 file holds a "Developer ID Application" certificate and its key. Export it from a Mac's Keychain, or create a signing request on Linux with `rcodesign generate-certificate-signing-request`.
- To also notarize, set `MAC_NOTARY_API_KEY` to a JSON file made from an App Store Connect API key with `rcodesign encode-app-store-connect-api-key -o key.json <issuer-id> <key-id> AuthKey_<key-id>.p8`. The notarization ticket is stapled to the app before it is zipped.

# Addon Testing (out-of-date)

1. while in the napi directory, `npm test` will run the only regression associated with libxulsword.

# TODOs

1. rework the code to utilize the `ObjectWrap` method of implementing the libxulsword interface
2. serious cleanup of both the `libsword.js`, `xulswordTest.js`, and `libsword_napi.cpp` files
3. coordinate with team to insure seamless integration
