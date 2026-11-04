#!/usr/bin/env bash
# Usage: util/updateDefaultModules.sh [--build-indexes]
#
# Replaces the default SWORD modules in assets/defaults/resources with fresh
# copies from CrossWire and IBT, and removes them from the
# moduleManager.suggested lists in assets/defaults/preferences/prefs.json
# (they are installed already, so they should not be suggested).
#
# Search indexes are not built by default, because they make the installer
# much larger and xulsword builds them itself after installation. With
# --build-indexes a search index is also built for each module. This uses
# xulsword's own libxulsword addon, so the indexes are made by the same
# CLucene that xulsword searches with, and the addon must be built and
# installed first (see Cpp/libxulsword-build.sh and 'yarn install-libxulsword').

set -euo pipefail

XULSWORD="$(cd "$(dirname "$0")/.." && pwd)"
RES="$XULSWORD/assets/defaults/resources"
PREFS="$XULSWORD/assets/defaults/preferences/prefs.json"
ADDON="$XULSWORD/node_modules/libxulsword/build/Release/libxulsword.node"
CPPLIB="$XULSWORD/Cpp/lib"

CROSSWIRE_URL="https://crosswire.org/ftpmirror/pub/sword/packages/rawzip"
CROSSWIRE_MODULES=(KJVA LXX OSHB TR WHNU Robinson StrongsGreek StrongsHebrew)

IBT_URL="https://ibtrussia.org/ftpmirror/pub/modsword/rawzip"
IBT_MODULES=(StrongsGreekRU StrongsHebrewRU RSP)

MODULES=("${CROSSWIRE_MODULES[@]}" "${IBT_MODULES[@]}")

BUILD_INDEXES=false
for arg in "$@"; do
  case "$arg" in
    --build-indexes) BUILD_INDEXES=true ;;
    *)
      echo "Usage: $0 [--build-indexes]" >&2
      exit 1
      ;;
  esac
done

REQUIRED=(curl unzip perl jq)
if $BUILD_INDEXES; then REQUIRED+=(node); fi
for cmd in "${REQUIRED[@]}"; do
  if ! command -v "$cmd" >/dev/null; then
    echo "ERROR: $cmd is required." >&2
    exit 1
  fi
done
if $BUILD_INDEXES && [[ ! -e "$ADDON" || ! -e "$CPPLIB/libxulsword-static.so" ]]; then
  echo "ERROR: libxulsword is not built or installed ($ADDON, $CPPLIB)." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Download everything first, so a failed download leaves the current default
# modules in place.
download() {
  local url="$1" module="$2"
  echo "Downloading $module"
  curl -fsSL -o "$TMP/$module.zip" "$url/$module.zip"
  if ! unzip -tq "$TMP/$module.zip" >/dev/null; then
    echo "ERROR: $url/$module.zip is not a valid zip file." >&2
    exit 1
  fi
}

for m in "${CROSSWIRE_MODULES[@]}"; do download "$CROSSWIRE_URL" "$m"; done
for m in "${IBT_MODULES[@]}"; do download "$IBT_URL" "$m"; done

echo "Deleting old modules from $RES"
rm -rf "$RES/mods.d" "$RES/modules"

for m in "${MODULES[@]}"; do
  echo "Installing $m"
  unzip -q -o "$TMP/$m.zip" -d "$RES"
done

# Build search indexes. HOME is set to an empty directory so SWORD cannot
# also load modules from ~/.sword, which may have the same names. SWORD's
# 'Error reading ulBuffNum' messages are dropped: they are harmless, and are
# printed for every verse of a testament a module doesn't have (like LXX).
buildIndexes() {
  mkdir "$TMP/home"
  # shellcheck disable=SC2016 # ${...} below is JavaScript
  HOME="$TMP/home" LD_LIBRARY_PATH="$CPPLIB" node -e '
  const [addon, dir, ...modules] = process.argv.slice(1);
  const lib = require(addon);
  // libxulsword requires both these callbacks.
  globalThis.ToUpperCase = (s) => (s ? s.toUpperCase() : "");
  globalThis.ReportSearchIndexerProgress = () => {};
  if (!lib.GetXulsword(dir)) {
    console.error(`ERROR: libxulsword could not load modules from ${dir}`);
    process.exit(1);
  }
  const installed = lib
    .GetModuleList()
    .split("<nx>")
    .map((s) => s.split(";")[0]);
  let failed = 0;
  modules.forEach((m) => {
    if (!installed.includes(m)) {
      console.error(`ERROR: ${m} was not installed.`);
      failed += 1;
      return;
    }
    console.log(`Indexing ${m}`);
    if (lib.LuceneEnabled(m)) lib.SearchIndexDelete(m);
    if (!lib.SearchIndexBuild(m) || !lib.LuceneEnabled(m)) {
      console.error(`ERROR: Search index failed for ${m}.`);
      failed += 1;
    }
  });
  lib.FreeLibXulsword();
  process.exit(failed ? 1 : 0);
' "$ADDON" "$RES" "${MODULES[@]}" 2>&1 | grep -v '^Error reading ulBuffNum$'

  # libxulsword caches the module configs, but the cache shouldn't be shipped.
  rm -f "$RES/mods.d/modules-conf.cache"
}
if $BUILD_INDEXES; then buildIndexes; fi

# Remove the modules from the suggested lists of prefs.json. Module names are
# not case sensitive.
MODS="${MODULES[*]}" perl -i -pe '
  if (/^\s*"(\w+)"\s*:\s*\[/) {
    my $list = $1;
    foreach my $m (split(" ", $ENV{MODS})) {
      if (s/"\Q$m\E"\s*,\s*//i || s/\s*,?\s*"\Q$m\E"//i) {
        print STDERR "Removed $m from moduleManager.suggested.$list\n";
      }
    }
  }
' "$PREFS"

lower=$(printf '"%s",' "${MODULES[@]}" | tr '[:upper:]' '[:lower:]')
left=$(jq -r --argjson mods "[${lower%,}]" '
  .moduleManager.suggested // {} | to_entries[] | .key as $k
  | .value[] | select(ascii_downcase | IN($mods[])) | "\($k): \(.)"
' "$PREFS")
if [[ -n "$left" ]]; then
  echo "ERROR: Default modules are still in moduleManager.suggested of $PREFS:" >&2
  echo "$left" >&2
  exit 1
fi

echo "Finished: ${MODULES[*]}"
