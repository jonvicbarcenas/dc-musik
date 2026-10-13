#!/bin/sh
set -eu

# Only names are printed on configuration errors, never supplied credentials.
fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_enabled() {
  case "$1" in
    true) [ -n "$2" ] || fail "Set $3 before enabling its source." ;;
    false) ;;
    *) fail "Source toggles must be true or false; check $3." ;;
  esac
}

ll_password=${LAVALINK_PASSWORD:-}
[ "${#ll_password}" -ge 16 ] || fail 'Set LAVALINK_PASSWORD to at least 16 characters.'
case "$ll_password" in
  replace_*|replace-*|changeme*|your_*|youshallnotpass)
    fail 'Replace the example LAVALINK_PASSWORD with your own random secret.' ;;
esac

require_enabled "${SPOTIFY_ENABLED:-false}" "${SPOTIFY_CLIENT_ID:-}" SPOTIFY_CLIENT_ID
require_enabled "${SPOTIFY_ENABLED:-false}" "${SPOTIFY_CLIENT_SECRET:-}" SPOTIFY_CLIENT_SECRET
require_enabled "${APPLE_MUSIC_ENABLED:-false}" "${APPLE_MUSIC_TOKEN:-}" APPLE_MUSIC_TOKEN
require_enabled "${DEEZER_ENABLED:-false}" "${DEEZER_ARL:-}" DEEZER_ARL
require_enabled "${DEEZER_ENABLED:-false}" "${DEEZER_MASTER_DECRYPTION_KEY:-}" DEEZER_MASTER_DECRYPTION_KEY
require_enabled "${YANDEX_MUSIC_ENABLED:-false}" "${YANDEX_MUSIC_ACCESS_TOKEN:-}" YANDEX_MUSIC_ACCESS_TOKEN
require_enabled "${SPOTIFY_LYRICS_ENABLED:-false}" "${SPOTIFY_SP_DC:-}" SPOTIFY_SP_DC
require_enabled "${DEEZER_LYRICS_ENABLED:-false}" "${DEEZER_ARL:-}" DEEZER_ARL
require_enabled "${YANDEX_LYRICS_ENABLED:-false}" "${YANDEX_MUSIC_ACCESS_TOKEN:-}" YANDEX_MUSIC_ACCESS_TOKEN

# Empty strings must not be bound as real poTokens, refresh tokens, or endpoint URLs.
if [ -n "${YOUTUBE_OAUTH_REFRESH_TOKEN:-}" ]; then
  export PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN="$YOUTUBE_OAUTH_REFRESH_TOKEN"
elif [ "${YOUTUBE_OAUTH_ENABLED:-false}" = true ] && [ "${YOUTUBE_OAUTH_SKIP_INITIALIZATION:-false}" = true ]; then
  fail 'Set YOUTUBE_OAUTH_REFRESH_TOKEN before skipping OAuth initialization.'
fi

if [ -n "${YOUTUBE_PO_TOKEN:-}" ] || [ -n "${YOUTUBE_VISITOR_DATA:-}" ]; then
  [ -n "${YOUTUBE_PO_TOKEN:-}" ] && [ -n "${YOUTUBE_VISITOR_DATA:-}" ] \
    || fail 'Set both YOUTUBE_PO_TOKEN and YOUTUBE_VISITOR_DATA.'
  export PLUGINS_YOUTUBE_POT_TOKEN="$YOUTUBE_PO_TOKEN"
  export PLUGINS_YOUTUBE_POT_VISITORDATA="$YOUTUBE_VISITOR_DATA"
fi

if [ -n "${SPOTIFY_TOKEN_ENDPOINT:-}" ]; then
  case "$SPOTIFY_TOKEN_ENDPOINT" in
    https://*) export PLUGINS_LAVASRC_SPOTIFY_CUSTOMTOKENENDPOINT="$SPOTIFY_TOKEN_ENDPOINT" ;;
    *) fail 'SPOTIFY_TOKEN_ENDPOINT must use HTTPS.' ;;
  esac
fi

exec java -jar /opt/Lavalink/Lavalink.jar "$@"
