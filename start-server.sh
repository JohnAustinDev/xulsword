#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )"

export LD_LIBRARY_PATH=./Cpp/lib 
../.nvm/versions/node/v18.18.0/bin/node -r ./.erb/scripts/babel-register ./src/server/server.ts
