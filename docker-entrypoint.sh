#!/bin/sh
set -e

# The media service runs as a child of the API server, per ADR-0006: one GPU
# device mapping, one log stream, one restart policy. If it dies, the whole
# container should die so the orchestrator restarts both together rather than
# leaving an API that cannot play anything.

flux-transcoder serve &
TRANSCODER_PID=$!

terminate() {
  kill "$TRANSCODER_PID" 2>/dev/null || true
  exit 0
}

trap terminate TERM INT

node apps/server/dist/Main.js &
SERVER_PID=$!

# Exit as soon as either half stops.
wait -n "$TRANSCODER_PID" "$SERVER_PID"
EXIT_CODE=$?

kill "$TRANSCODER_PID" "$SERVER_PID" 2>/dev/null || true

exit "$EXIT_CODE"
