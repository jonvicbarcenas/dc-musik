# Phase 4 — Core music engine

Phase 4 of eight is implemented. The command framework and commands come in Phase 5;
Discord bootstrap, events, controller components, and localization come in Phase 6.
The permanent regression suite comes in Phase 7 and the complete deployment README
comes in Phase 8. No Discord login or real source credentials were used in this phase.

## What is implemented

| Module                        | Behavior                                                                                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerManager`               | Bot-account/guild-scoped players, serialized controls, playback IDs, queue snapshots, history, pause/resume, seek, skip/skip-to, previous/replay, stop/disconnect, move, volume, loop, autoplay, idle leave, and 24/7 settings.   |
| `QueueManager`                | One-based move/swap/remove/ranges, shuffle, clear, dedupe, copy-safe views, bounded capacity, and 20-second undo. Consuming a track invalidates undo.                                                                             |
| `SourceResolver`              | Provider links and prefixed searches, paged metadata, validated audio resolution, attachments/direct audio, safe restoration, related-track lookup, mirror cache, and a shared concurrency bound.                                 |
| `CatalogClient`               | Paged Spotify Web API and public Deezer metadata. It never downloads their preview URLs or records credentials in tracks.                                                                                                         |
| `MirrorMatcher`               | ISRC-first searches, artist/title matching, a hard inclusive ±10-second duration limit, official/Topic preference, and rejection of previews, streams, unrelated songs, and unrequested live/remix/cover/sped-up/slowed variants. |
| `ImportScheduler`             | Bounded metadata jobs, first-five response, batched append/checkpoint, cancellation, persisted progress, and resuming unfinished imports.                                                                                         |
| `AutoplayEngine`              | Related YouTube mixes or artist search, recent guild history and requester history as seeds, and exclusion of queued/recent songs.                                                                                                |
| `FilterPresets`               | Bass, nightcore, vaporwave, 8d/rotation, karaoke, tremolo, vibrato, lowpass, five equalizer presets, validated speed/pitch/rate, and reset via an empty filter object.                                                            |
| `ProgressBar`                 | Bounded progress bars, finite durations, elapsed live-stream time, and shared time parsing/formatting.                                                                                                                            |
| `LavalinkTransport`           | Typed lavalink-client 2.11.0/v4 adapter, voice handshake, source loading, filters, optional SponsorBlock, failover, payload identity, readiness observation, and resumable socket shutdown.                                       |
| `RecoveryManager`             | Guarded snapshot recovery, deferred retries, and retaining queues when nodes or voice channels are temporarily unavailable.                                                                                                       |
| `LyricsService`               | LavaLyrics synced/text results, bounded cached lyrics, lyrics.ovh text fallback, and an LRC timestamp parser.                                                                                                                     |
| `Cache`                       | Bounded memory cache and optional namespaced Redis with memory fallback. Durable queues remain in the database.                                                                                                                   |
| `UrlGuard` / `SafeHttpClient` | Public IP validation, rejection of mixed/private DNS answers, DNS-pinned sockets, original Host/TLS SNI, redirect revalidation, body limits, deadlines, and restricted authenticated API origins.                                 |
| `MediaBridge`                 | Complete binary media downloads, persistent UUID files and HMAC signing key, authenticated byte-range serving, and a bounded disk cache.                                                                                          |

The queue belongs to the engine. The SDK may expose the current track for diagnostics;
its upcoming queue, repeat, autoplay, and automatic skipping are unused. Every playback
attempt has a UUID in Lavalink `userData`. Delayed events must match that UUID before
the engine advances, retries, or records a terminal history result.

## Full-song policy and source behavior

Spotify, Apple Music, Deezer, and Yandex entries are treated as catalog metadata.
Their encodings are never sent straight to playback. The engine searches YouTube Music,
YouTube, then SoundCloud, validates the candidate, and plays the selected complete
track. A missing full-length match is reported and skipped; there is no preview fallback.
Legitimate complete songs shorter than 30 seconds remain allowed. The duration guard
rejects short clips used in place of longer catalog songs.

Spotify uses the current `/playlists/{id}/items` Web API endpoint with client credentials
when access permits it. Access restrictions before the first page trigger the configured
LavaSrc metadata fallback. Failures after an import starts preserve the tracks already
queued and report the interruption. Apple Music and Yandex use the configured LavaSrc
source. Deezer public metadata works without enabling its optional direct-audio source.

The first five metadata entries are queued together, and playback resolution begins at
once. Remaining metadata pages append in batches. Mirroring continues in bounded
background workers; unavailable entries wait for a final attempt at their playback turn.
The public APIs support incremental metadata pagination. Lavalink's `loadtracks`
endpoint returns one aggregated metadata result, so the initial metadata delay for
LavaSrc/YouTube collections still depends on the upstream service and plugin limits.
Configured import and queue limits intentionally cap collections larger than those limits.
An interrupted import resumes against the playlist's current ordering; changing its
contents while the bot is offline can change what remains after its stored offset.

Public YouTube/YouTube Music video, playlist, mix, shorts, and live links; SoundCloud
track/set links; Twitch channels/videos; Bandcamp tracks/albums; and Vimeo videos are
canonicalized before reaching Lavalink. Queries support `ytsearch:`, `ytmsearch:`,
`scsearch:`, `spsearch:`, `amsearch:`, `dzsearch:`, `ymsearch:`, and `bcsearch:`.
Plain text defaults to YouTube search. Bare Spotify URI schemes and arbitrary Lavalink
source prefixes are rejected; use the supported public links or search prefixes.

Direct URLs and Discord attachments are downloaded by the bot, validated as binary
audio containers, and served to Lavalink through its trusted internal media bridge.
MP3/AAC, Ogg, FLAC, WAV, MP4, and WebM containers are accepted. Remote HLS/M3U/XML
manifests and HTML pages are rejected. Cached file UUIDs survive restart; saved HTTP
encodings are re-resolved through that UUID instead of trusting an old user URL.
The bot media volume and bridge key must be retained for uploads to survive restart.

The media cache is capped at 20 times `MEDIA_MAX_BYTES` in total, with one bounded
download at a time. It reports a full cache instead of deleting files still used by
favorites, playlists, or another bot account. `pruneUnused` accepts the complete set
of retained UUIDs across all accounts and repositories, and removes only old,
unreferenced UUID files. Keep the configured bridge endpoint reachable only by Lavalink
and the bot. The generated HMAC links grant access to their individual files.

## Integration contract for Phases 5–6

1. Open/migrate the database and create repositories with environment-backed guild defaults.
2. Start one `MediaBridge` shared by all configured bot accounts on this process.
3. Create a namespaced cache, `createLavalinkClient`, `LavalinkTransport`, `CatalogClient`,
   `SourceResolver`, `AutoplayEngine`, `PlayerManager`, and `LyricsService` per bot account.
4. Register node/Discord event adapters **before** calling the SDK's `init` on Discord ready.
   Use `observeNodeReady`, which waits for both node information and the actual v4
   ready/session payload. The SDK's `connect` event can arrive earlier.
5. In the ready callback, call `node.updateSession(true, env.LAVALINK_RESUME_TIMEOUT_SECONDS)`.
   The v4 REST timeout is **seconds**. Then call `players.nodeConnected(node.id)` and
   `recovery.restoreAll()`. Resume session IDs are selected from the latest snapshots
   for this account before node initialization.
6. Forward Discord raw voice packets to `lavalink.sendRawData`. The SDK's `sendToShard`
   callback must send its voice-state payload through the guild's actual shard.
7. Deliver SDK `trackStart`, `trackError`, `trackStuck`, `trackEnd`, and `queueEnd` payloads
   through `trackEvent(payload)` to `players.onTrackEvent`. Terminal events carry their
   original `userData.playbackId`; never infer identity from the mutable SDK queue.
   With an empty SDK upcoming queue, natural completion arrives through `queueEnd`.
   Duplicate event delivery is safe for terminal playback IDs.
8. Forward node disconnect to `players.nodeDisconnected`. The SDK adapter waits for
   its automatic stuck-track stop before sending the next playback PATCH, preventing
   that stop from killing the replacement mirror.
9. Forward player position updates to `players.updatePosition`; start periodic snapshots
   with `players.startCheckpoints()`. Run deferred recovery at a bounded interval.
   `retryOffline` leaves already-playing guilds on the same node undisturbed.
10. The Discord recovery guard checks shard ownership, guild membership, channel
    existence, blacklist, Connect/Speak permissions, and stage-channel readiness.
    The command framework handles DJ, same-voice, vote skip, music-channel restrictions,
    and command cooldowns. The core exposes occupancy and move methods for voice events.
11. On shutdown, stop event/UI timers, call `players.close()`, then `transport.close()`,
    close caches and the shared media bridge, destroy Discord clients, and close the DB.
    Engine shutdown retains snapshots/import checkpoints. Adapter shutdown clears local
    SDK players before destroying sockets, preserving remote sessions for resumption.

`players.view(guildId)` returns a copied snapshot with the calculated current position.
`enqueue` accepts saved/selected `ResolvedItem` objects; `enqueueQuery` returns after
the first five additions or a smaller completed import. `mutateQueue` provides the
serialized queue-operation boundary. `enqueue` and `enqueueQuery` accept `append`,
`next`, and `now` modes. `skipTo` uses one-based upcoming positions.

Snapshots checkpoint position about every ten seconds and after controls. A crash can
replay up to that much audio, while keeping the queued songs. Existing catalog records
remain when the server limit is lowered; new additions are blocked until space exists.
Queue undo is intentionally in memory and does not survive a restart. Failover and
restart re-resolve saved tracks, preserve pause/filters/volume, and continue finite tracks
at the saved position. Live streams reconnect at their live edge.

## Verification

Strict TypeScript, zero-warning ESLint, Prettier, and the production tsup build pass.
The engine is exported at `dist/lib/music/index.js`; the later bot bootstrap is still
pending. All 48 temporary verification checks pass, covering:

- Queue operations, ranges, shuffle preservation, dedupe, bounded undo, copy isolation,
  time parsing, progress bars, filter validation, locks, concurrency, and synced lyrics.
- The inclusive mirror-duration boundary, preview/variant rejection, legitimate short
  songs, artist names containing “Live,” ISRC ranking, and excluding failed cached mirrors.
- Real SQLite queue/history checkpoints, rapid stale events, parallel relative seeks,
  loops, previous/replay, cancellation during resolution, guarded recovery, bot restart,
  node restart, failover, 24/7 behavior, snapshot conflicts, and a 1,005-song import.
- Import checkpoint restart without duplicating the first five; autoplay history/queue
  exclusions; paged Deezer/Spotify metadata; refreshed Spotify tokens; and preview secrecy.
- Private/mixed DNS rejection, socket address pinning, redirect revalidation, byte limits,
  binary container checks, authenticated media ranges, and a persistent signing key.
- SDK stuck-track cleanup ordering and waiting for the actual session-ready payload.

A separate local probe connected the installed SDK to **Lavalink 4.2.2** with all four
pinned plugins, enabled a **120-second** resumable session, and decoded a complete
WAV through the authenticated byte-range media bridge. The verification server was
stopped afterward. This probe did not connect to Discord voice or authenticate to
Spotify/Apple/Yandex/YouTube accounts. Those deployment smoke checks remain for the
bootstrapped application with the owner's credentials.

The verification fixtures live under ignored `data/phase-4-verification`; Phase 7 will
add the permanent Vitest suite under `tests/`. No dependencies changed in Phase 4.

## API references

- [Installed-client API documentation](https://tomato6966.github.io/lavalink-client/)
- [Lavalink v4 REST API](https://lavalink.dev/api/rest)
- [Pinned LavaSrc source documentation](https://github.com/topi314/LavaSrc/blob/4.8.3/README.md)
- [Spotify playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- [Spotify client credentials](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
