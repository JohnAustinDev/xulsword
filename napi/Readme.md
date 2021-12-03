* initial napi creation:
** npm install node-addon-api
** Construct package.json file using the 'npm init' command.
** Add dependencies section to the package.json file.
** Execute 'npm install' to install dependencies.
** Create a binding.gyp file.

* napi builds
* build the xulsword library
* set the LD_LIBRARY_PATH to include path to "libxulsword.so.1.4.4"
* build sword_napi module
** cd to napi
** node-gyp clean
** node-gyp configure
** node-gyp build
** testing
*** npm test
