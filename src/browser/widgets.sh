#!/usr/bin/bash

OUTDIR=$1

if [[ -z $OUTDIR || ! -d "$OUTDIR" ]]; then echo "ERROR: no widgets OUTDIR." && exit 1; fi
if [[ "$OUTDIR" =~ ^\. ]]; then OUTDIR="$(pwd)/./$OUTDIR"; fi
if [[ ! -e "$OUTDIR" ]]; then mkdir "$OUTDIR"; fi

cd "$( dirname "${BASH_SOURCE[0]}" )/../../"

source ./setenv
if yarn build:other; then
  cp "./build/app/dist/widgets"* "$OUTDIR"
else
  echo "ERROR: widget build failed."
  exit 1;
fi
