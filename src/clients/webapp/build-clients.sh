#!/usr/bin/bash

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
source "$HOME/.nvm/nvm.sh"
source ./setenv
yarn install

./src/clients/webapp/builder.pl $1 $2

