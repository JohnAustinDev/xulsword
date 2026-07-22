#!/usr/bin/bash

# NOTE: setenv variables might not have an expected effect because this script
# runs a previously built server which already has its env baked in.

cd "$( dirname "${BASH_SOURCE[0]}" )/../../../"
source ./setenv
export LD_LIBRARY_PATH='./Cpp/lib'

# The --preserve-symlinks flag is required since the package.json dependency
# of "libxulsword": "portal:./libxulsword" creates a symlink to the module.
"$NVM_DIR/versions/node/v${NODE_VERSION}/bin/node" --preserve-symlinks ./build/webapp
