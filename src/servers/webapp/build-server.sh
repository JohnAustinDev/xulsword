#!/usr/bin/bash

DEVEL=$1

cd "$(dirname "${BASH_SOURCE[0]}" )/../../../"
source "$HOME/.nvm/nvm.sh"
source ./setenv

cd ./build/app
yarn install

cd ../..
yarn install

yarn install-libxulsword

if [[ -z "$DEVEL" ]]; then
  yarn webpack --env production --env webappSrv
else
  yarn webpack --env development --env webappSrv
fi
