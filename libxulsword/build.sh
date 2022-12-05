#!/bin/bash
source ./cross-compile 1

npx node-gyp configure

patch -s -p0 < build.patch

npx node-gyp build

