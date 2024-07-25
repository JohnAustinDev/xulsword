#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )/../../../"

source ./setenv

export LD_LIBRARY_PATH='./Cpp/lib'

NVMDIR=../../.nvm

if [[ -e "$NVMDIR" ]];
then
  $NVMDIR/versions/node/v22.2.0/bin/node ./build/webapp
else
  echo "Wrong path to .nvm directory."
fi
