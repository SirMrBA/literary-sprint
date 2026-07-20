#!/bin/zsh
set -e

cd -- "$(dirname -- "$0")"

PORT=8765
IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -z "$IP" ]]; then
  IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

echo
echo "Literary Sprint is starting..."
echo "Mac:  http://localhost:${PORT}/"
if [[ -n "$IP" ]]; then
  echo "iPad: http://${IP}:${PORT}/"
else
  echo "No Wi-Fi address found. Connect the Mac and iPad to the same Wi-Fi and try again."
fi
echo
echo "Keep this window open. Press Ctrl+C to stop."
echo

python3 -m http.server "$PORT" --bind 0.0.0.0 >/tmp/literary-sprint-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

sleep 1
open "http://localhost:${PORT}/"
wait "$SERVER_PID"
