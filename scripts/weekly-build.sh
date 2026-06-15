#!/bin/bash
set -euo pipefail

cd ~/projects/go-together.github.io

export PATH="/Users/soysen/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export NODE="/Users/soysen/.hermes/node/bin/node"

echo "[$(date)] Starting weekly build..."
npm run build
BUILD_EXIT=$?
echo "[$(date)] Build exit code: $BUILD_EXIT"

if [ $BUILD_EXIT -ne 0 ]; then
  echo "Build failed, skipping commit/push."
  exit $BUILD_EXIT
fi

echo "[$(date)] Build succeeded, checking git status..."
git status --short

if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git add -A
git commit -m "chore: weekly build $(date '+%Y-%m-%d %H:%M')"
git push origin main
echo "[$(date)] Weekly build completed."
