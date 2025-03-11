#!/usr/bin/bash

DEVEL=$1

cd "$(dirname "${BASH_SOURCE[0]}" )/../../../"
source "$HOME/.nvm/nvm.sh"
nvm use 22
source ./setenv

if [[ -z "$DEVEL" ]]; then
  yarn webpack --env production --env webappSrv
else	
  yarn webpack --env development --env webappSrv
fi
