#!/usr/bin/env bash
# Upload assets/avatar.jpg as the bot's profile photo (Bot API setMyProfilePhoto, JPG only).
# Usage: ./scripts/set-avatar.sh [path/to/photo.jpg]
set -euo pipefail
cd "$(dirname "$0")/.."
PHOTO="${1:-assets/avatar.jpg}"
TOKEN=$(grep '^BOT_TOKEN=' .env | cut -d= -f2-)
curl -sS "https://api.telegram.org/bot${TOKEN}/setMyProfilePhoto" \
  -F 'photo={"type":"static","photo":"attach://avatar"}' \
  -F "avatar=@${PHOTO}"
echo
