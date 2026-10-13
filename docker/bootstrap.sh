#!/bin/sh
set -eu

# Railway mounts volumes as root. RAILWAY_RUN_UID=0 starts only this initializer as root.
# The bot itself always runs as the existing node user, including normal Compose runs.
if [ "$(id -u)" = 0 ]; then
  mkdir -p /app/persist/media /app/data /app/media-cache
  chown node:node /app/persist /app/persist/media /app/data /app/media-cache
  exec gosu node "$@"
fi
exec "$@"
