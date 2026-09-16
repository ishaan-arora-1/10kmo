#!/usr/bin/env bash
# Replaces the support email everywhere (website, legal pages, iPhone app, server).
# Usage: scripts/set-support-email.sh you@gmail.com
set -euo pipefail

new_email="${1:-}"
if [[ ! "$new_email" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
  echo "Usage: scripts/set-support-email.sh you@gmail.com" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
current_email="$(cat scripts/.support-email 2>/dev/null || echo "support@rightful.app")"

if [[ "$current_email" == "$new_email" ]]; then
  echo "Support email is already $new_email"
  exit 0
fi

files="$(grep -rlF --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  --exclude=set-support-email.sh --exclude=.support-email "$current_email" . || true)"

if [[ -z "$files" ]]; then
  echo "No files contain $current_email"
else
  escaped_current="$(printf '%s' "$current_email" | sed 's/[.[\*^$|]/\\&/g')"
  while IFS= read -r file; do
    sed -i.bak "s|$escaped_current|$new_email|g" "$file" && rm -f "$file.bak"
    echo "updated $file"
  done <<< "$files"
fi

echo "$new_email" > scripts/.support-email
echo "Support email is now $new_email. Commit and push the changes."
