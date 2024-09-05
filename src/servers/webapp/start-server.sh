#!/usr/bin/bash

NODE_EXE=$1

# NOTE: setenv is NOT sourced because this script only runs a previously built
# server which already has its env baked in.

if [[ ! -e "$NODE_EXE" ]]; then 
  echo 'Usage: ./start-server.sh path-to-node-executable'
  exit
fi

cd "$( dirname "${BASH_SOURCE[0]}" )/../../../"

export LD_LIBRARY_PATH='./Cpp/lib'

"$NODE_EXE" ./build/webapp
