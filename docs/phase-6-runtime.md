# Phase 6 — Runtime, events, and Discord UI

Phase 6 of eight completes the runnable bot: `src/index.ts`, `src/bot.ts`, and
`src/shard.ts`, Discord/Lavalink event adapters, localized embeds, the live controller,
search selection, and pagination. You can now configure credentials and try it.
Phase 7 adds the permanent test suite; Phase 8 supplies the full README.

## Try it now

Choose one run mode per bot account. Keep credentials in `.env` and leave that file
out of source control. Initial phase verification used isolated local fixtures;
later troubleshooting checked the configured audio service with real source access.

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
   Copy the bot token and application ID into `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`.
   Enable **Message Content Intent** on its Bot page so prefix commands work.
   The runtime requests Guilds, GuildVoiceStates, GuildMessages and MessageContent;
   it does not require the privileged Guild Members intent.
2. Copy `.env.example` to `.env` if `.env` does not exist. Replace the token, application
   ID and `LAVALINK_PASSWORD` placeholders. Use a random password of at least 16
   characters. Optionally set `DISCORD_GUILD_ID` to your test server for immediate
   guild-scoped slash registration, and set your ID in `OWNER_IDS`.
3. Use the portal's OAuth2 URL Generator with **bot** and **applications.commands**.
   Grant View Channels, Send Messages, Embed Links, Read Message History, Use External
   Emojis, Connect, Speak and Request to Speak. For threads, also grant Send Messages
   in Threads. Invite the application to your test server. Stage channels require a
   moderator to approve speaking, or the bot needs Mute Members to unsuppress itself.
4. Install dependencies and validate configuration:

   ```powershell
   npm ci
   npm run config:check
   ```

For a local Node process with Docker running the audio server:

```powershell
docker compose up -d lavalink
docker compose ps lavalink
npm run commands:register
npm run dev
```

Wait for Lavalink to report healthy before starting playback. For the compiled bot,
use `npm run build` followed by `npm start`. Check readiness in a second terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

For both services in Docker:

```powershell
docker compose up -d --build
docker compose run --rm --no-deps bot node dist/scripts/register-commands.js
docker compose logs -f bot
```

The container uses the **compiled** registration script; development tools are absent
from its production dependencies. Its readiness check is:

```powershell
docker compose exec bot node dist/scripts/healthcheck.js
```

After joining a voice channel, try:

```text
!play artist - song
!search artist - song
!queue
!np
!pause
!resume
!leave
```

Slash equivalents use the same handlers. An audio attachment with `!play`, or the
slash command's `attachment` option, also works. A short complete WAV/MP3 is a useful
first check of the media/voice path. Search results exclude known previews. YouTube
playback can require OAuth/poToken configuration or fail upstream; the complete
source setup and troubleshooting guide follows in Phase 8.

For Spotify metadata, enable `SPOTIFY_ENABLED` and supply the Spotify client ID and
secret in `.env`, then recreate Lavalink and restart the bot. Spotify catalog entries
are matched to full tracks through the existing mirroring engine. Direct Spotify
audio and preview clips do not enter the queue.

Spotify playlist reading additionally needs an authorized account. The configured
application credentials can read song metadata, but do not identify a playlist
owner. Spotify's [current playlist API](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
restricts contents to the authorized owner or collaborator. To configure this:

1. Open the application's Settings in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
   Add and save the exact Redirect URI `http://127.0.0.1:8888/callback`. An alternative
   explicit loopback port can be configured in `SPOTIFY_REDIRECT_URI`; register that
   exact address instead. `localhost` and non-loopback callbacks are rejected.
2. On the Windows host, run:

   ```powershell
   npm run spotify:auth
   ```

3. Open the printed Spotify sign-in link and authorize an account that owns or
   collaborates on the playlist. This requests read-only playlist scopes. It stores
   `SPOTIFY_REFRESH_TOKEN` privately in `.env` and enables Spotify. No token needs
   to be copied into chat. Restart `npm run dev` so the running bot reloads `.env`.
4. Try `!play https://open.spotify.com/playlist/YOUR_PLAYLIST_ID` or `/play` with
   the same link. Spotify links continue to resolve matching full tracks through
   YouTube/SoundCloud.

For Development Mode, the Spotify application owner needs Premium and the sign-in
account must have access to the app. Check the application's User Management if an
account is rejected. See [Spotify's developer access requirements](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).
The bot accepts public playlists only: the operator's private libraries are not
exposed to other Discord users. Playlists from other people require collaborator
access, or an owned public copy. Spotify can still restrict app/account access.

Authorization uses PKCE and a random verified callback state, a loopback-only
listener and a fifteen-minute timeout. Refresh credentials rotate atomically under
the database's data directory, with private file permissions and a short file lease
shared by bot accounts/shards. These files contain credentials; keep the data
directory private. A revoked or expired authorization returns a sign-in instruction
instead of falling back to a second source and hiding the access failure. Failed
first-page imports report their authored reason once, and partial imports retain
already queued songs. The compiled helper is `node dist/scripts/spotify-auth.js`.
For the container bot, run authorization on the host and recreate the bot after
rebuilding it so the environment includes the new credential.

If YouTube finds a track but rejects its audio with `LOGIN_REQUIRED` or all clients
fail, run this on the Windows host from the project directory:

```powershell
npm run youtube:auth -- --start
```

The helper enables OAuth in the local `.env`, starts/recreates Lavalink, and prints
only Google's device verification address and code. Use a separate Google account,
as recommended by the [youtube-source documentation](https://github.com/lavalink-devs/youtube-source#using-oauth-tokens).
After approving access, save the refresh token privately without copying it into
the chat or terminal:

```powershell
npm run youtube:auth -- --save
```

The helper reads the authorized token through Lavalink's authenticated local API and
updates only the three YouTube OAuth keys in `.env`. Future Lavalink restarts use the
saved token. This helper requires Docker on the host; it does not run inside the bot
container. The compiled equivalent is `node dist/scripts/youtube-auth.js --start`
or `--save`. Authentication may still be rejected upstream; OAuth does not guarantee
YouTube availability. SoundCloud links/search and complete audio uploads remain
alternative ways to test playback. Provider debug logs may contain credentials and
signed media URLs; keep them private.

Compose also starts a pinned, self-hosted [yt-cipher](https://github.com/kikkia/yt-cipher)
service. The YouTube plugin uses it to interpret changing player signatures through
its supported [remote cipher integration](https://github.com/lavalink-devs/youtube-source#using-a-remote-cipher-server).
The service uses the IAS player variant, two workers and a bounded script cache. It
accepts the Lavalink password by default, runs without root, and publishes only on
`127.0.0.1:8001`. Blank `YOUTUBE_CIPHER_URL` and `YOUTUBE_CIPHER_PASSWORD` use these
local defaults. Set overrides only for a service you operate and trust. For a
standalone Lavalink JAR, start `docker compose up -d cipher` and explicitly set its
`YOUTUBE_CIPHER_URL=http://127.0.0.1:8001`. The Compose dependency ensures the service
starts before Lavalink; audio readiness still requires a working source request.

After changing the cipher or Lavalink configuration, apply it with:

```powershell
docker compose up -d --force-recreate --wait lavalink
```

You can still validate registration without credentials or network requests:

```powershell
npm run commands:register -- --dry-run
```

## Controller and menus

The Now Playing embed includes the original source, linked title, artist, artwork,
requester, progress, volume, loop, queue size, autoplay state and next song. Two rows
contain Previous, Pause/Resume, Skip, Stop, Shuffle, Loop, Volume −10/+10, Queue and
Favorite. Actions use the existing command executors, fresh member/settings checks,
DJ policy, vote-skip policy and cooldowns. Replies to controller actions are private.

Each controller is bound to its message and playback UUID. Disruptive mutations
check that UUID again inside the engine lock, so a delayed action cannot affect the
next song. Ended messages lose their components. There are at most three active
controllers per bot/server; a controller for a very long live stream expires after
24 hours and can be recreated with `/nowplaying`.

Progress updates use `CONTROLLER_UPDATE_INTERVAL_MS` (10 seconds by default). Edits
for a message are serialized and bursts replace the pending render. Terminal edits
cancel queued refreshes before removing components. Discord's REST client handles
the actual HTTP rate limits. Clean mode retains an active controller, then schedules
its deletion after playback ends. It also cleans the bot's own notice messages.

Search menus show up to ten entries, accept one choice from the requesting user,
expire after 60 seconds, and recheck playback permissions when selected. Queue,
favorites, playlist and history views have actor-bound Previous/Next buttons with
a two-minute lifetime. Private prefix libraries paginate in the caller's DMs while
retaining the originating server for authorization. Ephemeral menus edit through
their interaction webhook. Closed DMs still produce the existing friendly error.

Help uses a category select and rechecks administrator visibility when changed.
Lyrics use bounded pages. Timed lyrics show timestamped lines and update the current
line at the controller interval while their two-minute menu is active; a track
change removes their controls. Plain lyrics use the same pagination without a timer.
UI labels ship in English and Filipino/Tagalog. Command-authored notices remain
English; the dictionaries and typed translation helper provide the extension point.

Embeds/action rows retain the requested design. Discord's Components V2 flag disables
ordinary `embeds`, so mixing those two rendering models would change the message
layout. See [Discord's component reference](https://docs.discord.com/developers/components/reference).

## Startup and recovery

Startup validates environment, migrates SQLite, initializes the media cache, opens
health HTTP, and logs in each configured bot account. No slash registration happens
implicitly at boot. Client listeners are installed before Lavalink initialization.
Guild voice packets are forwarded to the SDK, which performs the Discord handshake;
the music engine remains the sole owner of the upcoming queue.

The Lavalink adapter waits for both node info and the v4 ready/session packet. It then
enables session resuming with `LAVALINK_RESUME_TIMEOUT_SECONDS` in **seconds**, restores
saved players for guilds owned by this client/shard, and retries deferred recovery
every 30 seconds. Session selection excludes other shards' guild snapshots. A failed
initial session PATCH also retries. Node disconnections freeze/persist positions and
attempt failover to another configured node. Queue CAS versions remain authoritative.

The pinned Lavalink 4.2.2 includes DAVE voice encryption support; the SDK's voice state
includes the required channel ID. See the [Lavalink changelog](https://github.com/lavalink-devs/Lavalink/blob/master/CHANGELOG.md).
Source availability and real Discord voice delivery still need a credentialed check.

Lavalink's `/tmp` mount allows executable mappings because it extracts the DAVE/Opus
JNI libraries there. The default Docker tmpfs `noexec` prevented those libraries from
loading even while the HTTP health check passed. The corrected container was recreated
and its logs confirmed `dave-jvm` loaded and the real bot WebSocket connected. The
YouTube client list prioritizes the OAuth-capable TV playback client after MUSIC
search and also includes the supported `TVHTML5_SIMPLY` fallback.

Startup diagnostics now report the failed step and an authored remedy, including
rejected Message Content Intent, an invalid token, application ID mismatch, port
conflicts, directory permissions and migration failures. Raw SDK errors and stack
traces remain hidden. Enable Message Content under your application's **Bot →
Privileged Gateway Intents** and save changes before using prefix commands.

SDK `queueEnd` events can represent ordinary track completion because its own queue
is intentionally empty. The adapter forwards their original payloads to the engine,
deduplicates shared payload objects, and uses payload playback IDs rather than the
mutable SDK current track. Existing stuck-track cleanup prevents the SDK's automatic
stop from stopping a replacement mirror.

Voice events count human listeners, update the idle rule, and handle moderator moves.
Stage joins request speaking approval. A kick clears that bot's player/saved queue
and leaves it disconnected so it does not fight a moderator. Normal process shutdown
preserves queues. Guild removal clears its bot-scoped player; a temporary unavailable
guild is retained for recovery.

`GET /health` returns 200 only when all configured accounts are logged in and each
has a prepared connected audio node. During startup or an audio outage it returns 503. `GET /live` checks the HTTP process itself. Responses expose aggregate bot/node
counts, with no server IDs, source URLs, credentials or queues.

Shutdown blocks new commands, cancels startup/source work, removes listeners and
timers, disables controls, checkpoints players and imports, drains command/component/
event work, closes SDK sockets, destroys Discord clients, closes HTTP/cache, and
finally closes SQLite. A pending gateway login is cancellable. Concurrent command
joins and background restoration share the same guild lock. Docker allows 60 seconds
for shutdown; the bot has a 45-second hard deadline and retains preceding checkpoints
if a final save fails.

## Sharding and optional extra accounts

After a production build:

```powershell
npm run start:sharded
```

`SHARD_COUNT=auto` lets ShardingManager choose the primary application's recommended
count. An explicit number is also supported. The supervisor owns the single media
bridge and health port. Children initialize its shared media key, open their SQLite
connections, and report aggregate readiness over IPC every ten seconds. A dead,
restarting or stale child makes supervisor readiness false. Shutdown first requests
graceful child termination, then stops remaining children after forty seconds.

Keep the count and run mode stable across ordinary restarts so saved Lavalink
sessions keep their ownership. When changing the count or switching between direct
and managed sharding, stop all bot processes and restart Lavalink before starting
the new layout; durable queues remain in SQLite. These SQLite/media arrangements
target multiple local processes on one host. Cross-host scaling needs shared media,
a PostgreSQL repository implementation, and distributed account coordination.

`EXTRA_BOT_TOKENS` is an optional JSON array of tokens for **separate applications**.
Enable Message Content and invite/register every application. They share per-server
settings and personal libraries, but own independent players, votes, node sessions,
and snapshots under their bot IDs. All run the same shard assignment in managed mode.

For a command invoked through the primary application, the coordinator first picks
the account already in the caller's voice channel. For a join/play request while
that account is busy elsewhere, it reserves an idle invited account. Reservations
cover pending joins, and saved queues also count as occupied channels. Prefix replies
come from the selected account. A delegated primary slash reply still belongs to
the primary application, while playback/announcements use the selected account;
component routing finds the actual owning renderer. Explicit mentions or slash
commands on an extra account target that account. Shared admin settings refresh the
other active accounts. Every selected account independently checks permissions.

## Verification

Local checks cover controller actions, stale playback races, expired/actor-bound
menus, DM pagination, help permission changes, embed bounds, timed lyrics, health
HTTP, serialized edits, event draining, natural completion, kicks, account selection,
shard session ownership, concurrent restoration, cancelled startup, and readiness.
All **214 local checks** pass: 50 engine checks, 92 command checks, and 72 runtime/UI/
authorization checks including safe startup diagnostics. Temporary checks are under ignored
`data/phase-6-verification`; Phase 7 promotes them into the permanent test suite.

An actual local Lavalink 4.2.2 with all four configured plugins passed initial event
readiness, session initialization, authenticated WAV loading, a real process restart,
disconnect/reconnect dispatch, new session initialization, second recovery dispatch,
and full cached audio decoding. Compiled bootstrap imports, dry-run registration and
fail-fast configuration checks also passed. Those initial checks did not use a real
Discord login, voice stream, source account access, or authenticated slash registration.

The first checks ran with Docker's engine stopped. During subsequent troubleshooting,
the engine came online and `docker compose up -d lavalink` built and started the
Lavalink image successfully. Compose reported it healthy, and an authenticated local
API check confirmed Lavalink 4.2.2 and all four configured plugins. The bot image and
actual voice playback still need their own live check. The Node build and native
SQLite checks pass on the installed Windows runtime.

The later startup troubleshooting run authenticated read-only Discord API requests,
confirmed the primary application ID, and reproduced the gateway rejection with
Message Content Intent disabled. It did not send Discord messages, register commands,
or connect voice. The local audio service was unreachable and Docker's engine was
stopped; Docker Desktop launch was requested, but the engine did not become ready
during that first diagnostic run. On the next troubleshooting run it became ready,
and the Lavalink container passed its health check.

Subsequent live playback troubleshooting identified the blocked DAVE native library,
YouTube's login requirement and a player-signature parsing failure. The container
mount now loads DAVE successfully. Google device authorization completed and the
refresh token was saved privately through the helper. The local yt-cipher service
resolved the current player script. The same Hale video (`8jl-EFeR8rM`) returned
HTTP 200 with 16,881 bytes on the first stream read, and an isolated Lavalink player
started it without a track exception during the eight-second check. That probe
did not join Discord voice; audible delivery still requires retrying in the user's
voice channel. All 198 engine/command/runtime checks and 21 configuration/health
checks passed again, along with type checking, lint and the production build.

Spotify playlist troubleshooting then confirmed application authentication succeeded
(HTTP 200) while the playlist-items API rejected the application-only request
(HTTP 401); Lavalink's metadata fallback returned empty. Account authorization and
specific import-error propagation were added. Fourteen isolated authorization checks
cover PKCE/state, declined/expired sign-in, loopback validation, concurrent token
refresh, token rotation across restarts, stale access-token invalidation, private
playlist blocking, application-only rejection, crashed refresh-lease recovery and
preservation of other credentials during setup. Two engine regressions verify
specific first-page errors preserve existing queues and bypass no access controls.
Real account sign-in and playlist import still require the operator's authorization.
