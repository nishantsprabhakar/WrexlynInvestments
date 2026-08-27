#!/usr/bin/env bash
# Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited. See LICENSE for details.
#
# Double-click/terminal entry point for Linux and macOS — the bash equivalent of
# scripts/launch.ps1. Installs dependencies on first run, builds if needed,
# starts the server, and opens the browser automatically.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is required but wasn't found. Install it, then run this again:" >&2
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "  Homebrew: brew install node" >&2
  else
    echo "  Debian/Ubuntu: sudo apt install nodejs npm" >&2
    echo "  Fedora:        sudo dnf install nodejs npm" >&2
    echo "  Arch:          sudo pacman -S nodejs npm" >&2
  fi
  echo "  Or download from: https://nodejs.org" >&2
  exit 1
fi

echo ""
echo "===================================="
echo "        Wrexlyn for Investments"
echo "===================================="
echo ""

if [ ! -d "$ROOT/node_modules" ]; then
  echo "First-time setup: installing dependencies (this can take a minute)..."
  npm install
fi

# Rebuild if dist/ is missing OR stale relative to the checked-out commit — "missing" alone
# isn't enough: a manually pulled update leaves an old dist/server/index.js sitting there
# untouched, and the app would silently launch mismatched compiled output against new source.
BUILD_SHA_PATH="$ROOT/dist/.build-sha"
CURRENT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"

NEEDS_BUILD=0
if [ ! -f "$ROOT/dist/server/index.js" ]; then
  NEEDS_BUILD=1
elif [ -n "$CURRENT_SHA" ]; then
  BUILT_SHA="$(cat "$BUILD_SHA_PATH" 2>/dev/null || true)"
  if [ "$BUILT_SHA" != "$CURRENT_SHA" ]; then
    NEEDS_BUILD=1
  fi
fi

if [ "$NEEDS_BUILD" = "1" ]; then
  echo "Building..."
  npm run build
  if [ -n "$CURRENT_SHA" ]; then
    printf '%s' "$CURRENT_SHA" > "$BUILD_SHA_PATH"
  fi
fi

PORT="${PORT:-4500}"
export PORT

echo ""
echo "Starting server and opening your browser..."
echo "(Close this terminal, or Ctrl+C, at any time to stop.)"
echo ""

bash "$ROOT/scripts/open-browser-when-ready.sh" "$PORT" &
disown

exec node "$ROOT/dist/server/index.js"
