# Phase 1: Project overview, folder tree, and dependencies

This project will implement a self-hosted Discord music bot in strict TypeScript, with slash commands, prefix commands, a shared command execution layer, persistent settings, and an interactive Now Playing controller. Files will be written into this workspace and printed in full as their implementation phase is delivered.

Phase 1 defines the implementation. The bot is not implemented or runnable yet. Subsequent phases will supply working code, migrations, deployment configuration, tests, and the final README.

## Architecture

1. Discord messages, slash commands, and controller interactions enter a shared command context. Argument parsing, cooldowns, blacklist checks, voice membership, DJ permissions, and guild restrictions run before command execution.
2. SourceResolver loads catalog metadata and playable sources. Spotify and Apple Music metadata is mirrored to playable YouTube, YouTube Music, or SoundCloud tracks. Deezer and Yandex receive source-specific adapters rather than being assumed to behave like Spotify.
3. MirrorMatcher rejects previews and candidates outside the requested duration tolerance, scores title and artist similarity, prefers official audio, and excludes unrequested alternate versions. No preview URL is used as a fallback. If no acceptable full-track match exists, the bot reports that the track is unavailable.
4. QueueManager owns queue edits, ordering, undo, deduplication, limits, and persistence. PlayerManager adapts that state to Lavalink and serializes player mutations so rapid commands cannot race.
5. SQLite stores settings, favorites, playlists, history, queue snapshots, and blacklists. Repository interfaces keep application logic independent of the SQLite driver; a PostgreSQL implementation requires its own schema, migrations, and repository adapter.
6. Event handlers coordinate track transitions, playback failures, voice changes, recovery, and announcements. UI builders produce embeds and components with expiring, authorized interaction sessions and message edits coalesced into approximately ten-second progress updates.

The audio client will be **lavalink-client**. Its documented Discord gateway integration, player events, queue-store extension points, and disconnect options fit this project. The application will add durable snapshots and recovery coordination around those APIs. See the [official lavalink-client README](https://github.com/Tomato6966/lavalink-client/blob/main/README.md).

LavaSrc exposes preview information as well as catalog metadata. Preview rejection will explicitly check those fields, and application-side matching will enforce the duration and version rules before a mirror is queued. See the [official LavaSrc documentation](https://github.com/topi314/LavaSrc).

Session resumption covers a temporary client connection loss while a Lavalink session survives. A Lavalink process restart requires rebuilding players from persisted state. Recovery will distinguish those cases and preserve queue order, current track, position, pause state, volume, filters, loop mode, and unfinished import jobs. See the [Lavalink session API](https://lavalink.dev/api/rest#update-session).

## Defaults and command decisions

| Setting                              | Default                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Application name                     | Discord Music Stream                                                    |
| Runtime compatibility                | Node.js 20.19+; Docker uses Node.js 24                                  |
| Prefix                               | `!`, plus mention prefix                                                |
| Theme                                | `#5865F2`                                                               |
| Language                             | English; Tagalog example included                                       |
| Initial volume                       | 80%, configurable from 1% to 200%                                       |
| Queue size                           | 2,000 tracks per player                                                 |
| Playlist import limit                | 2,000 tracks per import                                                 |
| Maximum finite track length          | 2 hours, configurable                                                   |
| Live streams                         | Allowed; seeking and finite-duration limits do not apply                |
| Initial playlist resolution batch    | First 5 tracks; remaining mirrors resolve in bounded background batches |
| Mirror duration tolerance            | At most 10 seconds shorter or longer than catalog duration              |
| Voice auto-leave timeout             | 120 seconds when idle or empty                                          |
| 24/7 mode                            | Off                                                                     |
| Autoplay                             | Off                                                                     |
| Loop                                 | Off                                                                     |
| Vote-skip                            | Off; 50% of eligible human listeners when enabled, rounded up           |
| Now Playing announcements            | On                                                                      |
| Controller progress updates          | Approximately every 10 seconds while playing                            |
| Search selection timeout             | 60 seconds                                                              |
| Queue/help/lyrics pagination timeout | 120 seconds                                                             |
| Queue undo depth                     | 20 mutations                                                            |
| Clean mode                           | Off; deletes the bot's own command responses after a configurable delay |
| SponsorBlock                         | Off; opt-in sponsor segments only                                       |
| Redis                                | Optional cache and coordination support; SQLite remains durable storage |
| Extra bot tokens                     | Optional; each player and snapshot is scoped by bot ID and guild ID     |

`move` has two forms: `/move` or `!move` joins the invoker's voice channel; `/move from:2 to:5` or `!move 2 5` moves a queue entry. `skipto` and `jump` share one operation. `playnow` accepts the `forceplay` prefix alias. Other prefix aliases map to the same command executor as their slash command.

Current source capabilities and credentials will be documented accurately. Large imports lazily resolve playable mirrors; the initial metadata request can still take time when an upstream Lavalink source returns an aggregated playlist. Stage channels require permission to speak or moderator approval. Local attachments mean uploaded audio, not arbitrary filesystem paths.

Direct audio and attachment requests will pass through a bounded media bridge that validates public destinations, pins validated DNS addresses during fetching, and revalidates redirects. User-supplied internal URLs and local paths will be rejected. Lavalink's local-file source will remain disabled.

## Planned folder tree

This is the complete planned source layout. Only this Phase 1 document exists at this stage. Generated artifacts are identified below the tree.

```text
discord-music-stream/
  .dockerignore
  .env.example
  .gitignore
  .prettierignore
  .prettierrc.json
  Dockerfile
  docker-compose.yml
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  eslint.config.mjs
  drizzle.config.ts
  ecosystem.config.cjs
  README.md
  docs/
    phase-1-overview.md
  lavalink/
    application.yml
  scripts/
    register-commands.ts
    migrate.ts
    healthcheck.ts
  src/
    index.ts
    bot.ts
    shard.ts
    types.ts
    config/
      env.ts
    framework/
      Command.ts
      CommandContext.ts
      CommandRegistry.ts
      CommandHandler.ts
      ArgumentParser.ts
      InteractionRouter.ts
    commands/
      playback/
        play.ts
        playnext.ts
        playnow.ts
        search.ts
        pause.ts
        resume.ts
        stop.ts
        skip.ts
        skipto.ts
        previous.ts
        replay.ts
        seek.ts
        forward.ts
        rewind.ts
        join.ts
        leave.ts
      queue/
        queue.ts
        nowplaying.ts
        remove.ts
        move.ts
        swap.ts
        clear.ts
        shuffle.ts
        undo.ts
        dedupe.ts
        loop.ts
        autoplay.ts
      audio/
        volume.ts
        bassboost.ts
        nightcore.ts
        vaporwave.ts
        eightd.ts
        karaoke.ts
        tremolo.ts
        vibrato.ts
        rotation.ts
        lowpass.ts
        equalizer.ts
        filters.ts
        speed.ts
        pitch.ts
        rate.ts
      extras/
        lyrics.ts
        grab.ts
        favorites.ts
        playlists.ts
        history.ts
        stats.ts
        ping.ts
        help.ts
        invite.ts
        support.ts
        about.ts
      admin/
        settings.ts
        prefix.ts
        djrole.ts
        musicchannel.ts
        stay.ts
        defaultvolume.ts
        voteskip.ts
        announce.ts
        autoleave.ts
        language.ts
        clean.ts
        maxqueue.ts
        maxtracklength.ts
        sponsorblock.ts
        blacklist.ts
    events/
      ready.ts
      interactionCreate.ts
      messageCreate.ts
      voiceStateUpdate.ts
      trackStart.ts
      trackEnd.ts
      queueEnd.ts
      trackError.ts
      trackStuck.ts
      playerDisconnect.ts
      nodeEvents.ts
    lib/
      music/
        PlayerManager.ts
        QueueManager.ts
        SourceResolver.ts
        MirrorMatcher.ts
        FilterPresets.ts
        ProgressBar.ts
        AutoplayEngine.ts
        ImportScheduler.ts
        RecoveryManager.ts
        LyricsService.ts
        Track.ts
        sources/
          SourceCatalog.ts
          SpotifyCatalog.ts
          DeezerCatalog.ts
          YandexCatalog.ts
      db/
        client.ts
        schema.ts
        migrate.ts
        contracts.ts
        migrations/
          0000_initial.sql
          meta/
            _journal.json
            0000_snapshot.json
        repositories/
          guildSettings.ts
          userFavorites.ts
          playlists.ts
          history.ts
          queueSnapshots.ts
          blacklist.ts
      cache/
        Cache.ts
        MemoryCache.ts
        RedisCache.ts
      ui/
        embeds.ts
        components.ts
        paginator.ts
        NowPlayingController.ts
        SearchController.ts
        MessageEditor.ts
      utils/
        time.ts
        permissions.ts
        cooldowns.ts
        logger.ts
        i18n.ts
        errors.ts
        AsyncLock.ts
      security/
        UrlGuard.ts
        SafeHttpClient.ts
        MediaBridge.ts
    advanced/
      MultiBotCoordinator.ts
    locales/
      en.json
      tl.json
  tests/
    time.test.ts
    progress-bar.test.ts
    mirror-matcher.test.ts
    queue-manager.test.ts
    permissions.test.ts
    argument-parser.test.ts
    url-guard.test.ts
    recovery.test.ts
    fixtures.ts
  .github/
    workflows/
      ci.yml
```

`package-lock.json` will be generated by npm and committed for reproducible installation. `node_modules/`, `dist/`, `coverage/`, SQLite database files, media-cache files, Lavalink plugin downloads, and logs are generated runtime/build artifacts and will be ignored. Drizzle's migration metadata will be generated alongside the initial migration.

## Dependency list

The following npm versions were checked against registry metadata before this phase was written. Phase 2 will pin dependencies and generate the lockfile. Engine compatibility has been inspected; installation, type checking, and integration compatibility remain to be verified during implementation.

| Runtime package   | Version   | Purpose                                                             |
| ----------------- | --------- | ------------------------------------------------------------------- |
| `discord.js`      | `14.27.0` | Discord gateway, REST, slash builders, embeds, components, sharding |
| `lavalink-client` | `2.11.0`  | Lavalink v4 nodes, players, search, filters, events                 |
| `better-sqlite3`  | `12.11.1` | SQLite driver                                                       |
| `drizzle-orm`     | `0.45.4`  | Typed SQL schema and queries                                        |
| `dotenv`          | `18.0.7`  | Environment-file loading                                            |
| `zod`             | `4.6.6`   | Environment, persisted-state, and argument validation               |
| `pino`            | `10.4.0`  | Structured logging                                                  |
| `ioredis`         | `6.0.0`   | Optional Redis adapter                                              |
| `ipaddr.js`       | `2.5.0`   | IPv4/IPv6 address classification for URL protection                 |

| Development package     | Version    | Purpose                                      |
| ----------------------- | ---------- | -------------------------------------------- |
| `typescript`            | `5.9.3`    | Strict type checking                         |
| `tsx`                   | `4.23.15`  | Development runner and maintenance scripts   |
| `tsup`                  | `8.5.1`    | Production builds                            |
| `vitest`                | `3.2.7`    | Unit and recovery tests                      |
| `eslint`                | `9.39.5`   | ESLint flat configuration                    |
| `@eslint/js`            | `9.39.5`   | Core recommended ESLint rules                |
| `typescript-eslint`     | `8.71.1`   | TypeScript lint rules                        |
| `prettier`              | `3.9.10`   | Formatting                                   |
| `pino-pretty`           | `13.2.0`   | Readable development logs                    |
| `drizzle-kit`           | `0.31.11`  | Migration generation and schema tooling      |
| `@types/node`           | `20.19.43` | Node.js API types at the compatibility floor |
| `@types/better-sqlite3` | `9.6.0`    | SQLite driver types                          |

Lavalink runs as a separate service. These server components are not npm dependencies:

| Component           | Version            | Purpose and source                                                                                                   |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Lavalink            | `4.2.2`            | Audio service; [official release](https://github.com/lavalink-devs/Lavalink/releases/tag/4.2.2)                      |
| LavaSrc             | `4.8.3`            | Additional catalog sources; [official release](https://github.com/topi314/LavaSrc/releases/tag/4.8.3)                |
| youtube-source      | `1.18.2`           | YouTube playback and search; [official release](https://github.com/lavalink-devs/youtube-source/releases/tag/1.18.2) |
| LavaLyrics          | `1.1.0`            | Lyrics REST API and synced events; [official release](https://github.com/topi314/LavaLyrics/releases/tag/1.1.0)      |
| SponsorBlock plugin | `3.0.1`            | Optional segment skipping; [official release](https://github.com/topi314/Sponsorblock-Plugin/releases/tag/3.0.1)     |
| Redis               | `7.4` image series | Optional Docker Compose profile                                                                                      |

YouTube OAuth and poToken settings will be exposed as optional environment configuration and explained using the [youtube-source authentication documentation](https://github.com/lavalink-devs/youtube-source#using-oauth-tokens). Availability depends on upstream services, account permissions, and region restrictions; unavailable sources will produce actionable errors.

## Delivery and verification

The remaining phases follow the requested order: configuration and deployment; database; music engine; command framework and commands; events and UI; tests; README.

The final verification will run installation, strict TypeScript checking, ESLint, Prettier, Vitest, and the production build. Docker and authenticated Discord/Lavalink playback checks will be run when the required runtime and credentials are available. Any checks that cannot run will be identified explicitly; a successful build will not be presented as proof of live playback.

Phase 1 is complete. Reply `continue` for Phase 2: configuration, environment validation, Docker, and Lavalink setup.
