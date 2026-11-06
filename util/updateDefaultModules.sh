#!/usr/bin/env bash
# Usage: util/updateDefaultModules.sh [--build-indexes] <scp-source>
#
# Replaces the default SWORD modules in assets/defaults/resources with fresh
# copies, and writes the moduleManager.suggested lists of
# assets/defaults/preferences/prefs.json.
#
# The modules of MODULES_EN, MODULES_RU and MODULES_ORIG are installed. Each
# module zip (like KJVA.zip) is taken from the first of these that has it:
#   1. <scp-source>, a directory of module zips that is copied from with scp,
#      such as user@host:/path/to/rawzip.
#   2. The rawzip directory of the SWORD repository with the newest version of
#      the module, of all those in CrossWire's master repository list. If that
#      version can't be downloaded, the script stops with an error, and the
#      module must be gotten some other way.
# Where each module came from is listed at the end.
#
# Each installed module is given a version newer than any SWORD repository
# has, so Module Manager does not replace it right away (see packageVersions
# below).
#
# SUGGESTED_EN and SUGGESTED_RU replace the 'en' and 'ru' lists of
# moduleManager.suggested in prefs.json. They may not include any of the
# installed modules, since those are installed already.
#
# Search indexes are not built by default, because they make the installer
# much larger and xulsword builds them itself after installation. Any search
# indexes that come in the module zips are deleted for the same reason. With
# --build-indexes a search index is also built for each module. This uses
# xulsword's own libxulsword addon, so the indexes are made by the same
# CLucene that xulsword searches with, and the addon must be built and
# installed first (see Cpp/libxulsword-build.sh and 'yarn install-libxulsword').

MODULES_EN=(KJVA StrongsGreek StrongsHebrew Robinson Packard OSHM)
MODULES_RU=(RSP StrongsGreekRU StrongsHebrewRU)
MODULES_ORIG=(LXX OSHB TR WHNU)

# shellcheck disable=SC2034 # used by name, as SUGGESTED_$lang
SUGGESTED_EN=(SBLGNT NASB NETfree engNET2016eb NETmaps BDBGlosses_Strongs AbbottSmithStrongs)
# shellcheck disable=SC2034
SUGGESTED_RU=(SBLGNT RusCARS RusCARSDict RUSCB RusSynodalLIO RusVZh)

set -euo pipefail

XULSWORD="$(cd "$(dirname "$0")/.." && pwd)"
RES="$XULSWORD/assets/defaults/resources"
PREFS="$XULSWORD/assets/defaults/preferences/prefs.json"
ADDON="$XULSWORD/node_modules/libxulsword/build/Release/libxulsword.node"
CPPLIB="$XULSWORD/Cpp/lib"

MASTER_REPO_LIST="https://crosswire.org/ftpmirror/pub/sword/masterRepoList.conf"

MODULES=("${MODULES_EN[@]}" "${MODULES_RU[@]}" "${MODULES_ORIG[@]}")
SUGGESTED_LANGS=(EN RU) # SUGGESTED_EN is written to suggested.en, etc.

usage() {
  echo "Usage: $0 [--build-indexes] <scp-source>" >&2
  exit 1
}

BUILD_INDEXES=false
SCP_SOURCE=""
for arg in "$@"; do
  case "$arg" in
    --build-indexes) BUILD_INDEXES=true ;;
    -*) usage ;;
    *)
      if [[ -n "$SCP_SOURCE" ]]; then usage; fi
      SCP_SOURCE="${arg%/}"
      ;;
  esac
done
if [[ -z "$SCP_SOURCE" ]]; then usage; fi

REQUIRED=(curl ssh scp tar unzip perl jq fc-scan)
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

# No suggested module may be one of the installed modules. Module names are
# not case sensitive.
checkSuggested() {
  local -n sug="SUGGESTED_$1"
  local s m bad=false
  for s in "${sug[@]}"; do
    for m in "${MODULES[@]}"; do
      if [[ "${s,,}" == "${m,,}" ]]; then
        echo "ERROR: $s is in SUGGESTED_$1, but it is also an installed module." >&2
        bad=true
      fi
    done
  done
  ! $bad
}
collision=false
for lang in "${SUGGESTED_LANGS[@]}"; do
  if ! checkSuggested "$lang"; then collision=true; fi
done
if $collision; then exit 1; fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The value of a conf file entry (read from stdin), like confEntry Version.
confEntry() {
  tr -d '\r' | sed -n "/^$1[[:space:]]*=/{s/^[^=]*=[[:space:]]*//p;q;}"
}
# The leading number part of a version, or 1.0 (SWORD's default) if none.
versionNumber() {
  local v
  v=$(grep -oE '^[0-9]+(\.[0-9]+)*' <<<"$1" || true)
  echo "${v:-1.0}"
}

# Read the master repository list, and the module configs of every SWORD
# repository in it. Each repository's HTTPS, HTTP or FTP address is used, in
# that order of preference. A repository that can't be read is skipped, and
# listed at the end.
REPO_NAMES=()
REPO_URLS=()
VERSIONS="$TMP/versions.tsv"           # repository index, lowercase module name, version
REPO_WARNINGS="$TMP/repo-warnings.txt" # repositories that couldn't be read
repoVersions() {
  : >"$VERSIONS"
  : >"$REPO_WARNINGS"
  local list="$TMP/masterRepoList.conf"
  if ! curl -fsSL --connect-timeout 20 --max-time 60 -o "$list" "$MASTER_REPO_LIST"; then
    echo "  All of them: the SWORD repository list $MASTER_REPO_LIST could not be read" >>"$REPO_WARNINGS"
    return
  fi

  local -A index=() ranks=()
  local line type name host path proto rank i
  while IFS= read -r line; do
    line="${line%$'\r'}"
    if [[ ! "$line" =~ ^[0-9]+=([A-Za-z]+)=([^|]+)\|([^|]+)\|([^|]*)$ ]]; then
      continue
    fi
    type="${BASH_REMATCH[1]}" name="${BASH_REMATCH[2]}"
    host="${BASH_REMATCH[3]}" path="${BASH_REMATCH[4]}"
    case "$type" in
      HTTPSPackagePreference) proto=https rank=3 ;;
      HTTPPackagePreference) proto=http rank=2 ;;
      FTPSource) proto=ftp rank=1 ;;
      *) continue ;;
    esac
    if [[ -z "${index[$name]:-}" ]]; then
      index[$name]=${#REPO_NAMES[@]}
      REPO_NAMES+=("$name")
      REPO_URLS+=("")
    fi
    if ((rank > ${ranks[$name]:-0})); then
      ranks[$name]=$rank
      path="${path#/}"
      REPO_URLS[${index[$name]}]="$proto://$host/${path%/}"
    fi
  done <"$list"

  # Get the config files of all repositories at once.
  local -a pids=()
  for i in "${!REPO_NAMES[@]}"; do
    mkdir -p "$TMP/repos/$i"
    (curl -fsSL --connect-timeout 20 --max-time 120 "${REPO_URLS[$i]}/mods.d.tar.gz" \
      | tar -xz -C "$TMP/repos/$i") 2>/dev/null &
    pids[i]=$!
  done

  for i in "${!REPO_NAMES[@]}"; do
    if ! wait "${pids[$i]}"; then
      echo "  ${REPO_NAMES[$i]} (${REPO_URLS[$i]})" >>"$REPO_WARNINGS"
      continue
    fi
    find "$TMP/repos/$i" -type f -name '*.conf' -exec awk -v repo="$i" '
      FNR == 1 { if (mod != "") print repo "\t" tolower(mod) "\t" ver; mod = ""; ver = "" }
      { sub(/\r$/, "") }
      mod == "" && /^\[[^]]+\]/ { mod = substr($0, 2, index($0, "]") - 2) }
      ver == "" && /^Version[ \t]*=/ { ver = $0; sub(/^[^=]*=[ \t]*/, "", ver) }
      END { if (mod != "") print repo "\t" tolower(mod) "\t" ver }
    ' {} + >>"$VERSIONS"
  done
}
echo "Reading SWORD repositories"
repoVersions

# The zips at <scp-source>. Getting the list first means a failed connection
# stops the script, rather than looking as though no module is there.
if [[ "$SCP_SOURCE" == *:* ]]; then
  scpHost="${SCP_SOURCE%%:*}"
  scpDir="${SCP_SOURCE#*:}"
  scpDir="${scpDir#\~/}" # ssh starts in the home directory
  # shellcheck disable=SC2029 # the path is quoted for the remote shell here
  if ! SCP_LIST=$(ssh "$scpHost" "ls -1 -- $(printf '%q' "${scpDir:-.}")"); then
    echo "ERROR: Could not list $SCP_SOURCE" >&2
    exit 1
  fi
else
  if ! SCP_LIST=$(ls -1 -- "$SCP_SOURCE"); then
    echo "ERROR: Could not list $SCP_SOURCE" >&2
    exit 1
  fi
fi

# Download everything first, so a failed download leaves the current default
# modules in place. Each module is unzipped to $TMP/stage/<module>, and
# installed from there at the end.
declare -A SOURCE=() # where each module came from
zipVersion() {
  unzip -p "$1" 'mods.d/*.conf' 2>/dev/null | confEntry Version || true
}
# Possible rawzip directories of a repository, like .../sword/packages/rawzip
# for .../sword/raw, or .../modsword/rawzip for .../modsword/raw.
rawzipDirs() {
  local base="${REPO_URLS[$1]}"
  local parent="${base%/*}"
  echo "$base/rawzip"
  echo "$parent/rawzip"
  echo "$parent/packages/rawzip"
}
# Download module $1, version $3, from the rawzip directory of repository
# index $2 to $4. A rawzip directory may be shared by several repositories
# (like the CrossWire ones), so a zip is only used if it has the version
# that the repository lists.
repoDownload() {
  local m="$1" i="$2" ver="$3" zip="$4" dir
  while IFS= read -r dir; do
    if curl -fsSL --connect-timeout 20 --max-time 600 -o "$zip" "$dir/$m.zip" 2>/dev/null \
      && unzip -tq "$zip" >/dev/null 2>&1 \
      && [[ "$(versionNumber "$(zipVersion "$zip")")" == "$ver" ]]; then
      SOURCE[$m]="$dir/$m.zip (${REPO_NAMES[$i]} $ver)"
      return 0
    fi
    rm -f "$zip"
  done < <(rawzipDirs "$i")
  return 1
}
# Repository indexes and versions of module $1, newest version first, as
# lines of: version, repository index.
repoModule() {
  local i mod ver
  while IFS=$'\t' read -r i mod ver; do
    if [[ "$mod" == "${1,,}" ]]; then
      printf '%s\t%s\n' "$(versionNumber "$ver")" "$i"
    fi
  done <"$VERSIONS" | sort -s -t $'\t' -k1,1Vr
}
download() {
  local m="$1" zip="$TMP/zips/$1.zip" name ver i newest="" tried=""
  mkdir -p "$TMP/zips"

  name=$(grep -ixF -- "$m.zip" <<<"$SCP_LIST" | head -n 1 || true)
  if [[ -n "$name" ]]; then
    scp -q "$SCP_SOURCE/$name" "$zip"
    SOURCE[$m]="$SCP_SOURCE/$name"
  else
    # The repository with the newest version (or any of them, if several
    # have that version). If that version can't be downloaded, stop: an
    # older one won't do.
    while IFS=$'\t' read -r ver i; do
      if [[ -z "$newest" ]]; then newest="$ver"; fi
      if [[ "$ver" != "$newest" ]]; then break; fi
      tried+=" ${REPO_NAMES[$i]},"
      if repoDownload "$m" "$i" "$ver" "$zip"; then break; fi
    done < <(repoModule "$m")
    if [[ -z "$newest" ]]; then
      echo "ERROR: $m is not at $SCP_SOURCE, and no SWORD repository has it." >&2
      exit 1
    fi
    if [[ -z "${SOURCE[$m]:-}" ]]; then
      echo "ERROR: $m is not at $SCP_SOURCE, and its newest version $newest (in${tried%,})" >&2
      echo "could not be downloaded from a rawzip directory. Get $m $newest some other" >&2
      echo "way, such as by adding it to $SCP_SOURCE." >&2
      exit 1
    fi
  fi

  if ! unzip -tq "$zip" >/dev/null; then
    echo "ERROR: ${SOURCE[$m]} is not a valid zip file." >&2
    exit 1
  fi
  mkdir -p "$TMP/stage/$m"
  unzip -q "$zip" -d "$TMP/stage/$m"
  if ! compgen -G "$TMP/stage/$m/mods.d/*.conf" >/dev/null; then
    echo "ERROR: ${SOURCE[$m]} has no mods.d config file." >&2
    exit 1
  fi
  echo "Downloaded $m from ${SOURCE[$m]}"
}
for m in "${MODULES[@]}"; do download "$m"; done

# Delete search indexes that came in the zips.
find "$TMP/stage" -type d -name lucene -prune -print \
  | while IFS= read -r dir; do
    echo "Deleting search index of ${dir#"$TMP/stage/"}"
    rm -rf "$dir"
  done

# Each module's Font (if it has one) must be one of the fonts in $RES/fonts.
# A Font that is a URL is not checked. Font files that no module uses are
# listed at the end.
fontFamilies() {
  fc-scan --format '%{family}\n' "$1" 2>/dev/null \
    | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true
}
FAMILIES=$(
  for f in "$RES"/fonts/*; do
    if [[ -f "$f" ]]; then fontFamilies "$f"; fi
  done | sort -u
)
USED_FONTS=""
missing=false
for m in "${MODULES[@]}"; do
  font=$(cat "$TMP/stage/$m"/mods.d/*.conf | confEntry Font || true)
  font=$(sed 's/[[:space:]]*$//; s/^"\(.*\)"$/\1/' <<<"$font")
  if [[ -z "$font" || "$font" == *://* ]]; then continue; fi
  USED_FONTS+="$font"$'\n'
  if ! grep -qixF -- "$font" <<<"$FAMILIES"; then
    echo "ERROR: $m uses font '$font', which is not in $RES/fonts." >&2
    missing=true
  fi
done
if $missing; then
  echo "Add the missing fonts to $RES/fonts and run again." >&2
  exit 1
fi
UNUSED_FONTS=()
for f in "$RES"/fonts/*; do
  if [[ ! -f "$f" ]]; then continue; fi
  if ! grep -qixF -f <(fontFamilies "$f") <<<"$USED_FONTS"; then
    UNUSED_FONTS+=("${f##*/}")
  fi
done

# Give each module a version newer than any SWORD repository has, so Module
# Manager does not replace it right away. The newest version found
# (downloaded or in a repository) gets .1 added if it has one or two parts,
# otherwise its third part is incremented: 3.2 -> 3.2.1, 2.1.4 -> 2.1.5,
# 2.0.1.2 -> 2.0.2. The conf gets that Version and a 'Packaged with
# xulsword' History entry.
nextVersion() {
  local -a p
  IFS=. read -ra p <<<"$1"
  if ((${#p[@]} < 3)); then
    echo "$1.1"
  else
    echo "${p[0]}.${p[1]}.$((10#${p[2]} + 1))"
  fi
}
packageVersions() {
  echo "Module versions (downloaded, then in each SWORD repository that has it):"
  local m conf ours i mod theirs note found newest
  for m in "${MODULES[@]}"; do
    conf=$(compgen -G "$TMP/stage/$m/mods.d/*.conf" | head -n 1)
    ours=$(confEntry Version <"$conf")
    printf '  %-28s %s\n' "$m (downloaded)" "${ours:--}"
    newest=$(versionNumber "$ours")
    found=false
    while IFS=$'\t' read -r i mod theirs; do
      if [[ "$mod" != "${m,,}" ]]; then continue; fi
      found=true
      note=""
      if [[ "$ours" != "$theirs" ]]; then note="  (differs)"; fi
      printf '    %-26s %s%s\n' "${REPO_NAMES[$i]}" "${theirs:--}" "$note"
      newest=$(printf '%s\n' "$newest" "$(versionNumber "$theirs")" | sort -V | tail -n 1)
    done <"$VERSIONS"
    if ! $found; then echo "    (in no repository)"; fi

    newest=$(nextVersion "$newest")
    printf '  %-28s %s\n' "$m (packaged)" "$newest"
    if grep -qE '^Version[[:space:]]*=' "$conf"; then
      V="$newest" perl -i -pe '
        if (!$done && /^Version\s*=.*?(\r?\n)?$/) {
          my $nl = $1 // "\n";
          $_ = "Version=$ENV{V}$nl" . "History_$ENV{V}=Packaged with xulsword$nl";
          $done = 1;
        }
      ' "$conf"
    else
      if [[ -n "$(tail -c 1 "$conf")" ]]; then echo >>"$conf"; fi
      printf 'Version=%s\nHistory_%s=Packaged with xulsword\n' \
        "$newest" "$newest" >>"$conf"
    fi
  done
}
packageVersions

echo "Deleting old modules from $RES"
rm -rf "$RES/mods.d" "$RES/modules"
for m in "${MODULES[@]}"; do
  echo "Installing $m"
  cp -a "$TMP/stage/$m/." "$RES/"
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

# Replace the suggested lists of prefs.json. The list is replaced in place,
# so the rest of the file keeps its formatting. If the key isn't there, jq
# adds it (and reformats the file).
writeSuggested() {
  local -n sug="SUGGESTED_$1"
  local key="${1,,}" list
  list=$(printf '"%s", ' "${sug[@]}")
  list="[${list%, }]"
  KEY="$key" LIST="$list" perl -0777 -i -pe '
    s/("suggested"\s*:\s*\{[^{}]*?"\Q$ENV{KEY}\E"\s*:\s*)\[[^\]]*\]/$1$ENV{LIST}/s
  ' "$PREFS"
  if ! jq -e --arg k "$key" --argjson l "$list" \
    '.moduleManager.suggested[$k] == $l' "$PREFS" >/dev/null; then
    jq --arg k "$key" --argjson l "$list" \
      '.moduleManager.suggested[$k] = $l' "$PREFS" >"$TMP/prefs.json"
    cat "$TMP/prefs.json" >"$PREFS"
  fi
  echo "Wrote moduleManager.suggested.$key: ${sug[*]}"
}
for lang in "${SUGGESTED_LANGS[@]}"; do writeSuggested "$lang"; done

echo "Modules were downloaded from:"
for m in "${MODULES[@]}"; do
  printf '  %-16s %s\n' "$m" "${SOURCE[$m]}"
done

if [[ -s "$REPO_WARNINGS" ]]; then
  echo "WARNING: These SWORD repositories could not be read, so their versions were not compared:" >&2
  cat "$REPO_WARNINGS" >&2
  echo "This is usually OK, because those repositories don't usually have these modules." >&2
fi

if ((${#UNUSED_FONTS[@]})); then
  echo "WARNING: These files in $RES/fonts are not the Font of any installed module:" >&2
  printf '  %s\n' "${UNUSED_FONTS[@]}" >&2
fi

echo "Finished: ${MODULES[*]}"
