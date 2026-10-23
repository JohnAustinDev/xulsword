# An Ubuntu 24.04 image with everything needed to build the libxulsword
# binaries for Linux, Windows and MacOS. Use docker-build.sh to build the
# image and run init.sh in it, rather than using this file directly.

FROM ubuntu:24.04

# The build user's IDs should match the host user's, so that files copied
# to the host belong to that user.
ARG USER_UID=1000
ARG USER_GID=1000
ARG NODE_VERSION=24.18.0
ARG NVM_VERSION=0.40.1

ENV DEBIAN_FRONTEND=noninteractive

# Packages for the Linux build (PKG_DEPS in init.sh), then the Windows
# cross-compile, then the MacOS cross-compile, then those used by init.sh
# and setenv.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git subversion libtool-bin cmake autoconf make pkg-config zip curl \
      debhelper binutils gcc-multilib dpkg-dev libboost-dev \
      gcc-mingw-w64-i686-posix g++-mingw-w64-i686-posix \
      gcc-mingw-w64-x86-64-posix g++-mingw-w64-x86-64-posix mingw-w64-tools \
      clang lld llvm xz-utils \
      ca-certificates lsb-release rsync sudo \
    && rm -rf /var/lib/apt/lists/*

# init.sh will not run as root. The build user may use sudo, so that init.sh
# can install any dependencies which are missing from this image.
RUN userdel -r ubuntu 2>/dev/null; \
    groupadd -o -g "$USER_GID" builder \
    && useradd -o -m -u "$USER_UID" -g "$USER_GID" -s /bin/bash builder \
    && echo "builder ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/builder \
    && mkdir -p /home/builder/src \
    && chown builder:builder /home/builder/src

USER builder
WORKDIR /home/builder

# Node.js is needed to build the MacOS libxulsword.node addon. setenv loads
# nvm from ~/.nvm and selects NODE_VERSION. nvm requires bash.
SHELL ["/bin/bash", "-c"]
RUN export NVM_DIR="$HOME/.nvm" \
    && curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh" | PROFILE=/dev/null bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install "$NODE_VERSION" \
    && git config --global --add safe.directory /host

# docker-build.sh mounts the host's xulsword directory at /host.
CMD ["/host/init.sh"]
