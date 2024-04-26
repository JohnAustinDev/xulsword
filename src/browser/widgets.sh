#!/usr/bin/bash

OUTDIR=$1

if [[ -z $OUTDIR || ! -d "$OUTDIR" ]]; then echo "ERROR: no widgets '$OUTDIR'." && exit 1; fi
if [[ "$OUTDIR" =~ ^\. ]]; then OUTDIR="$(pwd)/./$OUTDIR"; fi
if [[ ! -e "$OUTDIR" ]]; then mkdir "$OUTDIR"; fi

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"

if [[ -e ./build/app/dist/widgets* ]]; then rm ./build/app/dist/widgets*; fi

source ./setenv
if [[ "$NODE_ENV" == "development" ]]; then
  yarn build:other-dev
else
  yarn build:other
fi

if [[ "$?" == "0" ]]; then
  cp "./build/app/dist/widgets"* "$OUTDIR"
else
  echo "ERROR: widget build failed."
  exit 1;
fi
