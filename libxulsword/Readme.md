# The XulSword Library Node.js Module

This Node.js module provides a JavaScript-based interface to the libxulsword dynamic library. The libxulsword shared object (dll on the Windows platform) should be constructed prior to building this module and, at leat for the time being, the shell's LD_LIBRARY_PATH environment variable set to include the path to the libxulsword library.

Once the libxulsword shared object build is complete it's time to build this Node.js module. Construction requires both the [Node.js](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04) engine and Google's [node-gyp](https://www.npmjs.com/package/node-gyp) build tool. Both these tools have their own prerequisites not enumerated here. This outline is described in Ubuntu 20.04 terms ... it will be edited to include Mac OS and Windows builds when it comes to cross-platform builds.

Installing Node.js includes its Node Package Manager, [npm](https://www.npmjs.com/package/npm) (verify). This tool is used to install node-gyp and [node-addon-api](https://github.com/nodejs/node-addon-api). It is this node-addon-api (napi) module that ultimately provides the JavaScript interface to the xulsword library.

Some of the early build steps outlined in the links above are not required since this directory already includes the package.json and binding.gyp files.

# The Build Process

1. change to the napi directory.
2. if this is the first time through the build process, you will want to run _node-gyp install_. No options required.
3. finally, _node-gyp rebuild_ will perform the node-gyp clean, configure, and build commands in sequence to produce the Node.js _sword_napi.node_ module located under the build/Release directory.

# Module Testing

1. while in the napi directory, _npm test_ will run the only regression associated with this module.

# TODOs

1. add licensing information
2. implement the three _libsword.js_ callback functions
3. rework the code to utilize the _ObjectWrap_ method of implementing the libxulsword interface
4. serious cleanup of both the _libsword.js_, _xulswordTest.js_, and _libsword_napi.cpp_ files
5. add build procedure to the top-level _build.sh_ script
6. coordinate with team to insure seamless integration of the module
7. replace the _xul/content/libsword.js_ file with the one currently located in the napi directory