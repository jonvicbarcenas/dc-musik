# Phase 2: Configuration, tooling, Docker, and Lavalink

Phase 2 supplies working configuration validation, build and lint tooling, a container health-check client, deployment files, and pinned Lavalink plugins. The Discord bot entry point and database schema arrive in later phases. `npm run build` currently builds the configuration tools; `npm start`, migration generation against the application schema, and the bot container become usable after their implementation phases.

## Local configuration

Use Node.js 20.19 or newer. The Docker build uses Node.js 24. The current workspace was checked with Node.js 24.13.0.

In PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
npm ci
```

Edit `.env` and set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and a random `LAVALINK_PASSWORD`. `DISCORD_GUILD_ID` is optional and will scope command registration to a development server. Generate a Lavalink password with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then validate:

```powershell
npm run config:check
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The configuration check validates `.env` and parses both YAML files. It does not authenticate with Discord, Spotify, or Lavalink. Invalid configuration reports field names and explanations without printing supplied values. Configuration is loaded explicitly at boot; importing the parser does not read `.env` or contact a service.

Booleans use `true` or `false`. Blank optional credentials and URLs are treated as unset. The embed color is quoted in `.env.example` because dotenv treats an unquoted `#` as the start of a comment. Production logging always disables pretty output.

The application will enforce bounded queue/import sizes, track lengths, source metadata page counts, request timeouts, and import concurrency. The source page settings are separate from the application import cap; source plugins can return more metadata than the bot will accept into the queue.

## Source credentials

YouTube, SoundCloud, Bandcamp, Twitch, and Vimeo are enabled in Lavalink. Its built-in YouTube source is disabled in favor of youtube-source. SoundCloud preview filtering is enabled, and the application resolver will add explicit preview and mirror-duration checks in Phase 4.

To enable Spotify, set `SPOTIFY_ENABLED=true`, `SPOTIFY_CLIENT_ID`, and `SPOTIFY_CLIENT_SECRET`. Apple Music requires `APPLE_MUSIC_ENABLED=true` and `APPLE_MUSIC_TOKEN`. Yandex requires its enable flag and access token. Unsupported or unavailable catalog entries will be reported rather than replaced with previews.

The optional LavaSrc direct Deezer source requires `DEEZER_ARL` and `DEEZER_MASTER_DECRYPTION_KEY`. The bot's Deezer metadata-and-mirroring adapter will work independently of enabling that source. No account credentials or decryption key are distributed with this project.

Spotify, Deezer, and Yandex lyrics are disabled until explicitly configured with their respective cookie/ARL/token. YouTube lyrics and the LavaSrc LRCLIB fallback are enabled. The application lyrics service will also provide an independent fallback.

The configuration follows the upstream [Lavalink server example](https://github.com/lavalink-devs/Lavalink/blob/4.2.2/LavalinkServer/application.yml.example), [LavaSrc source options](https://github.com/topi314/LavaSrc/blob/4.8.3/application.example.yml), and [LavaLyrics setup](https://github.com/topi314/LavaLyrics/blob/1.1.0/README.md).

## YouTube authentication

For OAuth, set `YOUTUBE_OAUTH_ENABLED=true`. With no refresh token, Lavalink initiates the device authorization flow and logs its instructions. After obtaining a refresh token, set `YOUTUBE_OAUTH_REFRESH_TOKEN` and restart Lavalink. Set `YOUTUBE_OAUTH_SKIP_INITIALIZATION=true` only when a refresh token is configured. The TV client is included as a fallback for OAuth-capable playback.

For poToken, provide both `YOUTUBE_PO_TOKEN` and `YOUTUBE_VISITOR_DATA`. Leave both blank when unused. The wrapper exports Spring properties only for nonempty values; this avoids accidentally binding empty strings as actual authentication tokens. The upstream [youtube-source authentication guide](https://github.com/lavalink-devs/youtube-source/blob/1.18.2/README.md#using-oauth-tokens) describes provider limitations and account considerations.

`SPOTIFY_TOKEN_ENDPOINT` optionally points to an operator-managed HTTPS token service. The wrapper binds it only when configured. It is not required for the default client-credential setup; some generated/private catalog data may require additional authorization.

For a standalone Java launch, uncomment the relevant optional token blocks in `application.yml` or set the equivalent `PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN`, `PLUGINS_YOUTUBE_POT_TOKEN`, `PLUGINS_YOUTUBE_POT_VISITORDATA`, and `PLUGINS_LAVASRC_SPOTIFY_CUSTOMTOKENENDPOINT` environment variables yourself. A standalone JAR does not automatically load the bot's `.env` file. Docker Compose supplies these through the wrapper.

## Docker Compose

Once the bot implementation is complete, start the deployment with:

```powershell
docker compose up --build -d
docker compose logs -f bot lavalink
```

To run Lavalink alone during development:

```powershell
docker compose up --build -d lavalink
```

Compose makes Lavalink available at `127.0.0.1:2333` on the host. The bot container connects using the `lavalink` service hostname. The Lavalink image is pinned to `4.2.2`; the small derived image adds curl for authenticated health checks and the optional-credential wrapper. Plugin downloads and logs use named volumes. The image's UID/GID 322 owns those directories.

The bot runs as the Node image's non-root user. Its filesystem is read-only apart from data/media volumes and `/tmp`. Lavalink also uses a read-only root filesystem with separate writable plugin/log volumes. Both services drop Linux capabilities and enable `no-new-privileges`. SQLite data, queue snapshots, and imported-playlist state will use the persistent bot data volume.

The bot waits for Lavalink's authenticated `/v4/info` health check. Its own health-check client requires an HTTP 200 response containing `{"status":"ready"}` from `/health`; the server for that endpoint arrives with bot bootstrap. Container restarts use `unless-stopped`.

Direct user URLs will be validated and fetched through the application media bridge in Phase 4. Compose advertises that bridge as `http://bot:3001`. When the bot runs on the host and Lavalink runs in Docker Desktop, set `MEDIA_BRIDGE_BIND=0.0.0.0` and `MEDIA_BRIDGE_PUBLIC_URL=http://host.docker.internal:3001`. A remote Lavalink node needs a reachable bridge origin appropriate to that deployment.

Keep the Lavalink REST password private: its HTTP source is intentionally enabled for the media bridge, and an operator with Lavalink API access can request URLs outside the bot's command-validation layer. Local filesystem playback remains disabled.

## Optional Redis

Leave `REDIS_URL` and `DOCKER_REDIS_URL` blank to use the in-memory cache. To enable the Compose Redis profile, set a random, URL-safe hexadecimal `REDIS_PASSWORD` and set:

```dotenv
DOCKER_REDIS_URL=redis://:YOUR_RANDOM_HEX_PASSWORD@redis:6379
```

Replace the placeholder with that password, then run:

```powershell
docker compose --profile redis up --build -d
```

Redis requires a nonempty password when the profile is enabled and has no published host port. Its append-only data is persisted in a named volume. `REDIS_URL` is for a bot running outside Compose; configure it for your separately reachable Redis server. Redis is a cache/coordination option and does not replace durable SQLite storage.

## Multiple nodes and PM2

`LAVALINK_NODES` accepts a JSON array with each node's `id`, `host`, `port`, `authorization`, and `secure` values. Optional `retryAmount` and `retryDelay` default to 100 attempts and five seconds. Node IDs must be unique. When this array is nonempty, it overrides the single-node connection settings for the bot. Compose still needs `LAVALINK_PASSWORD` for its managed local Lavalink service.

When configuring explicit nodes for Compose, use `lavalink` for the included service's host rather than `127.0.0.1`. Other hosts must be reachable from the container. The recovery manager will distinguish reconnecting to a surviving session from recreating a player after a server restart.

`ecosystem.config.cjs` supplies a single-process PM2 deployment with automatic restarts and a 20-second shutdown window. It becomes usable after the bot entry point is built. The later sharding entry will be used for Discord sharding rather than duplicating the same bot with PM2 cluster mode.

## Dependency changes from Phase 1

Installation and auditing identified newer compatible tool versions and affected transitive dependencies. Phase 2 uses Vitest `4.1.11`, Vite `7.3.7`, ESLint `10.12.0`, and `@eslint/js` `10.0.1`. `globals` and `yaml` support the lint and configuration-check tools.

The lockfile overrides esbuild to `0.28.2` and tinypool to `2.1.2`. These replace vulnerable transitive versions without moving the runtime floor beyond Node.js 20.19. A clean `npm ci`, a build, configuration checks, and migration-tool execution were used to check compatibility. The relevant upstream advisories are [Vitest's patched release](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [tinypool's patched versions](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), and [esbuild's development-server fix](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr).

## Verification boundary

The Phase 2 verification covers installation, strict TypeScript checking, linting, formatting, the configuration-tool build, 21 temporary configuration/health smoke checks, native SQLite loading, migration-tool operation on an isolated fixture, and Compose model validation. The fixture files and downloaded verification JAR live under ignored `data/phase-2-verification/`.

The official Lavalink `4.2.2` JAR was started locally with the project's YAML. It loaded youtube-source `1.18.2`, LavaSrc `4.8.3`, LavaLyrics `1.1.0`, and SponsorBlock `3.0.1`, and returned its authenticated `/v4/info` response. That temporary server was stopped after verification.

The Docker engine is stopped on this host, so image builds and container startup were not tested. Compose syntax was validated with `.env.example` interpolation and `--no-env-resolution`; no actual `.env` file or account credentials were created. Authenticated Discord voice playback, real source resolution, queue restoration, and the permanent test suite remain for later phases.

Phase 2 is complete. Reply `continue` for Phase 3: database schema, migrations, and typed repositories.
