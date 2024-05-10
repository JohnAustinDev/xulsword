#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"
XULSWORD="$(pwd)"

export LD_LIBRARY_PATH=./Cpp/lib 
$XULSWORD/../.nvm/versions/node/v20.12.2/bin/node -r ./.erb/scripts/babel-register ./src/server/server.ts
