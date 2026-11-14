#!/bin/bash
# Print GitHub release asset download counts, per release and in total.
#
# Usage: util/gh-downloads.sh [owner/repo]
#   owner/repo defaults to JohnAustinDev/xulsword.
#
# Uses the public GitHub REST API with no authentication (limited to 60
# requests per hour). Counts are cumulative since each asset was uploaded.
#
# What the asset counts mean:
#   latest*.yml      Auto-updater checks while that release was the newest.
#   *.blockmap       Differential update downloads (each update fetches both
#                    the old and the new version's blockmap).
#   .exe/.AppImage/.dmg/.zip  Manual downloads plus full-file updates.

set -euo pipefail

REPO="${1:-JohnAustinDev/xulsword}"

curl -fsSL -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/releases?per_page=100" |
python3 -I -c '
import json, sys
releases = json.load(sys.stdin)
total = 0
for r in releases:
    assets = sorted(r["assets"], key=lambda a: -a["download_count"])
    subtotal = sum(a["download_count"] for a in assets)
    total += subtotal
    date = (r.get("published_at") or "")[:10]
    print("%-12s %s  total %d" % (r["tag_name"], date, subtotal))
    for a in assets:
        print("    %7d  %s" % (a["download_count"], a["name"]))
print(f"ALL RELEASES: {total}")
'
