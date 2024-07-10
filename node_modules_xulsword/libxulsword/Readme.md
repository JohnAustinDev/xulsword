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

# Addon Testing (out-of-date)

1. while in the napi directory, `npm test` will run the only regression associated with libxulsword.

# TODOs

1. rework the code to utilize the `ObjectWrap` method of implementing the libxulsword interface
2. serious cleanup of both the `libsword.js`, `xulswordTest.js`, and `libsword_napi.cpp` files
3. coordinate with team to insure seamless integration
