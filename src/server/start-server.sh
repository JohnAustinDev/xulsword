#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"

source ./setenv

export LD_LIBRARY_PATH=./Cpp/lib
"$NVM_BIN/node" -r ./.erb/scripts/babel-register ./src/server/server.ts
