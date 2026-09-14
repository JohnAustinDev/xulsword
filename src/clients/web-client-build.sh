#!/usr/bin/bash
if [[ -z $1 ]]; then echo "Usage: ./web-client-build.sh path/to/dist [development]" & exit 0; fi

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
source "$HOME/.nvm/nvm.sh"
source ./setenv
yarn install

./src/clients/web-client-builder.pl $1 $2

