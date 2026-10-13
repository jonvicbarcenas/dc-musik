FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build

FROM base AS production-dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Source migration assets remain available for diagnostics; the runtime uses dist/migrations.
COPY src ./src
COPY docker/bootstrap.sh /app/docker/bootstrap.sh
RUN mkdir -p /app/data /app/media-cache /app/persist/media \
    && chown -R node:node /app/data /app/media-cache /app/persist \
    && chmod 755 /app/docker/bootstrap.sh
USER node
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "dist/scripts/healthcheck.js"]
ENTRYPOINT ["/usr/bin/tini", "--", "/bin/sh", "/app/docker/bootstrap.sh"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
