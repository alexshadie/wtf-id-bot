#!/usr/bin/env bash
# Redeploy on the server: pull, npm ci if dependencies changed, restart the unit.
# Run inside the app directory on the server: ./scripts/deploy.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

UNIT="${UNIT:-wtf-id-bot}"
FORCE=0; [[ "${1:-}" == "--force" ]] && FORCE=1

OLD=$(git rev-parse HEAD)
git fetch --quiet
NEW=$(git rev-parse '@{upstream}')

if [[ "$OLD" == "$NEW" && $FORCE -eq 0 ]]; then
  echo "✓ already at ${OLD:0:7} — nothing to deploy (use --force to restart anyway)"
  exit 0
fi

git pull --quiet --ff-only
if [[ $FORCE -eq 1 ]] || git diff --name-only "$OLD" "$NEW" | grep -qE '^package(-lock)?\.json$'; then
  npm ci
fi

sudo systemctl restart "$UNIT"
sleep 2
sudo systemctl status "$UNIT" --no-pager | head -5
echo "✓ deployed $(git rev-parse --short HEAD)"
