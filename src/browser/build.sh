#!/usr/bin/bash

OUTDIR=$1

if [[ -z $OUTDIR || ! -d "$OUTDIR/dist/" ]]; then echo "ERROR: no dist '$OUTDIR/dist'." && exit 1; fi
if [[ "$OUTDIR" =~ ^\. ]]; then OUTDIR="$(pwd)/./$OUTDIR"; fi

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"

rm "$OUTDIR/dist/"*;
rm -rf "./build/app/dist/"*;

source ./setenv

if [[ "$NODE_ENV" == "development" ]]; then
  yarn build:other-dev
else
  yarn build:other
fi

if [[ "$?" == "0" ]]; then
  cp "./build/app/dist/"* "$OUTDIR/dist"
  cp "./src/browser/bible-browser.html" "$OUTDIR/dist"
else
  echo "ERROR: react build failed."
  exit 1;
fi
