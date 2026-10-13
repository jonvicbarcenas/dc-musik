FROM ghcr.io/lavalink-devs/lavalink:4.2.2
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/Lavalink/plugins /opt/Lavalink/logs \
    && chown -R 322:322 /opt/Lavalink/plugins /opt/Lavalink/logs
COPY lavalink/bootstrap.sh /opt/Lavalink/bootstrap.sh
RUN chmod 755 /opt/Lavalink/bootstrap.sh
USER 322:322
ENTRYPOINT ["/bin/sh", "/opt/Lavalink/bootstrap.sh"]
