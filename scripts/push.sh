#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"commit message\""
  exit 1
fi

MSG="$*"

echo "Staging changes..."
git add .

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  echo "Committing: $MSG"
  git commit -m "$MSG"
fi

echo "Running npm run push..."
git push origin main
git push staging main
