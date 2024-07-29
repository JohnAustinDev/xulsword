#!/usr/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )/../../../"

source ./setenv

yarn webpack --env development --env webappSrv
