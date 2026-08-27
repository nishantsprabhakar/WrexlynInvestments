#!/usr/bin/env bash
# Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited. See LICENSE for details.
#
# Polls the server port and only opens the browser once it's actually
# accepting connections, instead of guessing with a fixed delay.
PORT="${1:-4500}"
TIMEOUT_SECONDS="${2:-30}"

deadline=$((SECONDS + TIMEOUT_SECONDS))
while [ "$SECONDS" -lt "$deadline" ]; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
    exec 3>&- 2>/dev/null || true
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
      open "http://localhost:$PORT" >/dev/null 2>&1 &
    fi
    exit 0
  fi
  sleep 0.4
done
# Timed out: the server never came up. Say nothing here — the main console
# window already shows whatever error caused that.
