#!/bin/bash

# Build the libxulsword binaries in a Docker container, and copy them into
# this xulsword directory:
#   Linux:   Cpp/lib
#   Windows: Cpp/lib.32win or Cpp/lib.64win, and libxulsword/lib/libxulsword.def
#   MacOS:   Cpp/lib.darwin and libxulsword/bin/darwin-universal-89
#
# The Windows and MacOS binaries are only built if they are enabled by
# WINMACHINE and MACMACHINE in setenv. The MacOS build also needs the MacOS
# SDK in the archive directory (see libxulsword/Readme.md).
#
# The code in this directory is built as it is now, including uncommitted
# changes. Build files are kept in a Docker volume, so later runs only
# rebuild what has changed.
#
# Usage: ./docker-build.sh [--clean]
#   --clean  Delete the cached build files first, and build everything.

IMAGE=xulsword-build
VOLUME=xulsword-build

cd "$( dirname "${BASH_SOURCE[0]}" )" || exit 5
XULSWORD="$(pwd)"

CLEAN=
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    *) echo "Usage: $0 [--clean]"; exit 1 ;;
  esac
done

SETENV="$XULSWORD/setenv"
if [ ! -e "$SETENV" ]; then SETENV="$XULSWORD/scripts/setenv"; fi
NODE_VERSION="$(sed -n 's/^export NODE_VERSION=//p' "$SETENV")"

# Only the Dockerfile is sent to Docker, not the whole xulsword directory.
docker build -t "$IMAGE" \
  --build-arg USER_UID="$(id -u)" \
  --build-arg USER_GID="$(id -g)" \
  ${NODE_VERSION:+--build-arg NODE_VERSION="$NODE_VERSION"} \
  - < "$XULSWORD/Dockerfile" || exit 1

if [ -n "$CLEAN" ]; then docker volume rm -f "$VOLUME" > /dev/null || exit 1; fi

TTY=
if [ -t 0 ] && [ -t 1 ]; then TTY=-it; fi

# shellcheck disable=SC2086
docker run --rm --init $TTY \
  -v "$XULSWORD:/host" \
  -v "$VOLUME:/home/builder/src" \
  "$IMAGE" /host/init.sh
