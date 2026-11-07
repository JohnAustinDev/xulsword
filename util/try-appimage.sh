#!/bin/bash
# Run an AppImage in a throwaway Docker container of another Linux
# distribution, with its window shown on this desktop.
#
# Usage: util/try-appimage.sh <image> <path/to/App.AppImage> [--headless]
#   <image>     ubuntu:22.04, ubuntu:24.04, debian:12, debian:13, fedora:41 ...
#   --headless  Use a virtual display in the container instead of this
#               desktop, and print the app's output for 30 seconds.
#
# The container has only the libraries a normal desktop install would have,
# so a missing-library error points at a real problem.

IMAGE="$1"
APPIMAGE="$(realpath "$2")"
HEADLESS="$3"
if [ -z "$IMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "Usage: $0 <image> <path/to/App.AppImage> [--headless]"; exit 1
fi

# Desktop libraries Electron needs, Mesa graphics drivers, plus su and
# useradd, which some container images leave out. Package names differ by family.
APT_PKGS="libgtk-3-0 libnss3 libgbm1 libasound2 libxss1 libxtst6 libnotify4 \
  libsecret-1-0 libdrm2 libxkbcommon0 libatspi2.0-0 libcups2 xdg-utils \
  fonts-dejavu-core ca-certificates libgl1-mesa-dri util-linux passwd"
DNF_PKGS="gtk3 nss mesa-libgbm alsa-lib libXScrnSaver libXtst libnotify \
  libsecret libdrm libxkbcommon at-spi2-core cups-libs xdg-utils \
  dejavu-sans-fonts ca-certificates mesa-dri-drivers util-linux shadow-utils"

# Package installs are logged to a file, which is shown only if they fail.
SETUP='
LOG=/tmp/install.log
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >>$LOG 2>&1 || { cat $LOG; exit 1; }
  # Newer Debian/Ubuntu renamed some packages with a t64 suffix.
  PKGS=; for p in '"$APT_PKGS"'; do
    if apt-cache show "${p}t64" >/dev/null 2>&1; then p="${p}t64"; fi; PKGS="$PKGS $p"
  done
  [ -n "$HEADLESS" ] && PKGS="$PKGS xvfb xauth"
  apt-get install -y -qq --no-install-recommends $PKGS >>$LOG 2>&1 || { cat $LOG; exit 1; }
else
  PKGS="'"$DNF_PKGS"'"
  [ -n "$HEADLESS" ] && PKGS="$PKGS xorg-x11-server-Xvfb xorg-x11-xauth"
  dnf install -y -q $PKGS >>$LOG 2>&1 || { cat $LOG; exit 1; }
fi
echo "== $(. /etc/os-release; echo $PRETTY_NAME), $(ldd --version | head -1)"
# tester gets the host user'"'"'s uid, so it may use the host'"'"'s X socket.
# -o because some images (ubuntu:24.04) already have a user with that uid.
useradd -m -o -u "$HOST_UID" tester
# tester joins the groups which own the host'"'"'s GPU devices, so it may use them.
for g in $GPU_GIDS; do
  name=$(getent group "$g" | cut -d: -f1)
  if [ -z "$name" ]; then name=gpu$g; groupadd -g "$g" $name; fi
  usermod -aG $name tester
done
cd /home/tester
# Extracting the AppImage avoids needing FUSE in the container.
# --no-sandbox because Chromium'"'"'s sandbox needs privileges Docker does not give.
su tester -c "/app.AppImage --appimage-extract >/dev/null"
RUN="/home/tester/squashfs-root/AppRun --no-sandbox $APP_FLAGS"
if [ -n "$HEADLESS" ]; then
  su tester -c "timeout 30 xvfb-run -a $RUN" 2>&1
  echo "== exit code $? (124 means it was still running after 30s; check the log above for errors)"
else
  su tester -c "DISPLAY=$DISPLAY $RUN"
fi
'

# LANG is passed so the app chooses this desktop's language.
ARGS=(--rm --shm-size=1g -v "$APPIMAGE:/app.AppImage:ro" -e HEADLESS="$HEADLESS" \
  -e HOST_UID="$(id -u)" -e LANG="${LANG:-C.UTF-8}" -e LANGUAGE="$LANGUAGE")
if [ -z "$HEADLESS" ]; then
  xhost +local: >/dev/null
  ARGS+=(-e DISPLAY="$DISPLAY" -v /tmp/.X11-unix:/tmp/.X11-unix)
  # The app finds this desktop's GPU through the X display, and its window
  # stays blank if it cannot then open the GPU device. So the container gets
  # the GPU devices, or else the app does not use a GPU.
  if [ -d /dev/dri ]; then
    GIDS="$(find /dev/dri -maxdepth 1 -type c -exec stat -c %g {} + | sort -u | tr '\n' ' ')"
    ARGS+=(--device /dev/dri -e GPU_GIDS="$GIDS")
  else
    ARGS+=(-e APP_FLAGS=--disable-gpu)
  fi
fi

docker run "${ARGS[@]}" "$IMAGE" bash -c "$SETUP"
