#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"

source ./setenv

export LD_LIBRARY_PATH=./Cpp/lib
NVMBIN=../.nvm/versions/node/v22.2.0/bin

"$NVMBIN/node" -r ./.erb/scripts/babel-register ./src/server/server.ts
