#!/bin/sh
set -e

# Both halves of Valence run in one container, per ADR-0006: one GPU device
# mapping, one log stream, one restart policy. They are siblings started by
# this shell, not a parent and a child — neither can find the other by walking
# the process tree, which is why what Valence costs is read from the cgroup and
# not from a process walk. If either dies, the whole container dies so the
# orchestrator restarts both together rather than leaving an API that cannot
# play anything.

valence-transcoder serve &
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
