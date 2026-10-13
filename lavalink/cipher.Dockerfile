FROM ghcr.io/kikkia/yt-cipher:master@sha256:4c5ec381ff57336cfc24822d2b526a5ad7cd0171f61065a1bbc87bb736842449
# Railway private networking uses IPv6. The writable cache remains disposable.
ENV HOST=:: \
    PORT=8001 \
    MAX_THREADS=2 \
    PREPROCESSED_CACHE_SIZE=20 \
    OVERRIDE_PLAYER_VARIANT=IAS \
    XDG_CACHE_HOME=/tmp/yt-cipher
