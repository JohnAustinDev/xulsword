#!/usr/bin/bash

cd "$(dirname "${BASH_SOURCE[0]}" )/../../../"
"$HOME/.nvm/nvm.sh" use 22
source ./setenv

yarn webpack --env development --env webappSrv
