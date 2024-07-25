#!/usr/bin/bash

DIST_PARENT_DIR=$1
IS_DEVELOPMENT=$2

if [[ -z "$DIST_PARENT_DIR" || ! -d "$DIST_PARENT_DIR/dist/" ]]; then 
  echo "Usage: build.sh DIST_PARENT_DIR [IS_DEVELOPMENT]"
  echo "ERROR: Not a directory: $DIST_PARENT_DIR/dist"
  exit 1
fi

if [[ "$DIST_PARENT_DIR" =~ ^\. ]]; then
  DIST_PARENT_DIR="$(pwd)/./$DIST_PARENT_DIR"
fi

cd "$( dirname "${BASH_SOURCE[0]}" )/../../.." || exit 5

rm "$DIST_PARENT_DIR/dist/"*;
rm -rf "./build/app/dist/"*;

source ./setenv

if [[ "$IS_DEVELOPMENT" == "1" ]]; then
  yarn webpack --env development --env webappClients
else
  yarn webpack --env production --env webappClients
fi

if [[ "$?" == "0" ]]; then
  cp "./build/webapp/dist/webappClients/"* "$DIST_PARENT_DIR/dist"
else
  echo "ERROR: react build failed."
  exit 1;
fi
