#!/usr/bin/bash

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

source ./setenv

./src/clients/webapp/builder.pl $1 $2

