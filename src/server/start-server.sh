#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"

source ./setenv

export LD_LIBRARY_PATH=./Cpp/lib
NVMBIN=../.nvm/versions/node/v22.2.0/bin

"$NVMBIN/node" -r ./scripts/babel-register.mjs ./src/server/server.ts
