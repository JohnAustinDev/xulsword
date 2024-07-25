#!/usr/bin/bash

NODE_VERSION=22.2.0
NVM_DIR=../.nvm

cd "$( dirname "${BASH_SOURCE[0]}" )/../../../"

source ./setenv

export LD_LIBRARY_PATH='./Cpp/lib'

NODE_EXE=versions/node/v$NODE_VERSION/bin/node

if [[ -e "$NVM_DIR" ]];
then
  if [[ -e "$NVM_DIR/$NODE_EXE" ]];
  then
    "$NVM_DIR/$NODE_EXE" ./build/webapp
  else
    echo "ERROR: .nvm/$NODE_EXE does not exist. Run 'nvm install $NODE_VERSION'"
  fi
else
  echo "ERROR: Wrong path to .nvm directory: $NVM_DIR"
fi
