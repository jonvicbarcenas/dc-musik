# Phase 5 — Command framework and commands

Phase 5 of eight implements **68 canonical slash commands**, their prefix aliases,
and shared execution logic. Bootstrap, Discord/Lavalink event adapters, localized UI
labels, embed builders, search menus, controllers, and paginators arrive in Phase 6.
The commands already execute against the music engine and repositories; they return
typed views through `CommandUI` for that renderer. The production bot entry point is
still pending. The permanent test suite and full README follow in Phases 7 and 8.

## Shared execution

Each command file exports `slash`, `aliases`, `execute`, and its default command
definition. A single argument schema produces both the Discord slash builder and
the prefix parser. Slash, prefix, and controller invocations call the same executor.
Aliases are prefix shortcuts; slash commands use the canonical names in the table.

Prefix commands accept the configured prefix, `<@bot-id>`, or `<@!bot-id>`.
Commands and subcommands are case-insensitive; playlist names preserve their case
and use the repository's normalization rules. Quote names when more arguments
follow them, for example `!playlists add "Road Trip" queue:2`.

Boolean prefix values accept `on/off`, `true/false`, `yes/no`, `enable/disable`, and
`1/0`. Slash commands expose native booleans. Times accept seconds, `mm:ss`,
`hh:mm:ss`, or ordered units such as `1h2m3s`. Whole-number options reject decimal
values. Slash role/channel options use Discord pickers; prefix commands accept
mentions or IDs. `off` clears the role/channel through prefix commands; slash
commands use `clear:true`.

`play`, `playnext`, and `playnow` accept either a query/link or **one audio upload**.
Prefix uploads use the message's first attachment; slash commands use `attachment`.
The upload path uses the validated, bounded media bridge. Query and attachment
together are rejected. Playlist responses describe the first additions while the
engine continues importing. Saved favorites and playlists enqueue unresolved catalog
entries for the same full-track matching policy as ordinary playback.

## Permissions and controls

- Playback additions, queue changes, and audio controls require the DJ role when
  one is configured. Manage Server and configured bot owners satisfy DJ/admin
  checks. Admin settings require Manage Server or a configured owner.
- Music controls require the caller in the bot's voice channel. Join/play require
  the caller's voice channel and cannot take over a different active channel.
  `move` with no positions explicitly moves the bot to the caller's channel.
- The current requester can skip their own track with a one-track skip. With
  vote skip enabled, other human listeners may vote without a DJ role. DJs,
  Manage Server, and configured owners bypass the vote. Multi-track skips require
  one of those privileges while vote skip is enabled. `jump`/`skipto` use the same
  skip/vote service rather than providing a vote bypass.
- Vote thresholds round up from non-bot listeners who are not deafened. Duplicate
  votes do not increase the count, and departed listeners are pruned. A conditional
  engine skip checks the captured playback UUID so a late vote cannot skip a new song.
- The music-channel restriction applies to playback, queue, audio, and current-song
  views. Settings, help, library management, and account information can be used
  elsewhere so administrators can repair a restriction.
- Blacklisted users/servers cannot use commands. Only configured bot owners can
  manage blacklists; the owner blacklist command remains usable to remove a block.
- Bot text permissions check View Channel, Send Messages/Send Messages in Threads,
  Embed Links, and Use External Emojis. Voice joins check View Channel, Connect,
  Speak, and capacity. An already-connected bot does not need another free slot.
- Stage joins request speaking approval when needed. A stage moderator must approve
  the bot, or grant its account Mute Members so it can unsuppress itself. The default
  invite requests Request to Speak without granting moderator permissions.

Cooldowns are shared across a user's commands and aliases in each bot/guild, with
the configured 1.5-second default. An additional in-flight guard rejects a second
copy of the same command while it is still running. Long playlist requests do not
prevent a different authorized command after the cooldown. Queue mutations remain
serialized by the music engine.

## Privacy and interactions

Favorites, personal playlists, history, and owner blacklist responses are private.
Slash replies are ephemeral, including follow-up replies. Prefix responses go to
the invoking user's DMs; a closed DM produces a short public error without private
details. `grab` sends song details to the caller's DMs and confirms in the server.
Uploaded audio never exposes its media-bridge HMAC URL through `grab`.

Sharing issues an opaque **read-only token** privately. Anyone with that token may
view or play the collection, subject to normal music permissions for playback.
Deletion, appending, removing, importing, and changing sharing still require the
playlist owner. Turning sharing off revokes the token. No public web endpoint or
automatic external publication is created.

`InteractionRouter` binds controls to a random nonce, action, message, destination
channel, originating guild, and optionally an actor. Menus can be one-shot and have
explicit expiry. Copied IDs, unknown actions, other actors, and expired messages
are rejected ephemerally. A busy flag is acquired before acknowledgment so two
simultaneous clicks cannot enter together. DM menus retain their originating guild
and source text channel for authorization, while remaining bound to their DM
message and user. Phase 6 will use these sessions for search and pagination.

Search callbacks recheck current voice membership, role/settings, blacklist, and
bot permissions before joining or adding the selected item. Page callbacks also
receive a fresh context and retain repository ownership checks. User errors contain
authored messages, never provider stack traces, SQL diagnostics, or token values.

Clean mode deletes only the bot's own guild command replies. It leaves user messages
and DM library responses intact. Ephemeral cleanup is capped at 14 minutes to stay
within the interaction token lifetime; ordinary guild replies use the configured
delay. A renderer may mark a live controller response as persistent.

## Command reference

The slash and prefix argument names match. Optional arguments are shown in brackets.
Prefix aliases appear after the canonical name. For complex library subcommands,
use the examples below the table.

| Category | Command           | Prefix aliases     | Arguments                                                      |
| -------- | ----------------- | ------------------ | -------------------------------------------------------------- |
| admin    | `/announce`       | —                  | `[enabled]`                                                    |
| admin    | `/autoleave`      | —                  | `[seconds]`                                                    |
| admin    | `/blacklist`      | —                  | `add, remove, list`                                            |
| admin    | `/clean`          | —                  | `[enabled] [seconds]`                                          |
| admin    | `/defaultvolume`  | —                  | `[percent]`                                                    |
| admin    | `/djrole`         | —                  | `[role] [clear]`                                               |
| admin    | `/language`       | —                  | `[code]`                                                       |
| admin    | `/maxqueue`       | —                  | `[count]`                                                      |
| admin    | `/maxtracklength` | —                  | `[time]`                                                       |
| admin    | `/musicchannel`   | —                  | `[channel] [clear]`                                            |
| admin    | `/prefix`         | —                  | `[value]`                                                      |
| admin    | `/settings`       | —                  | —                                                              |
| admin    | `/sponsorblock`   | —                  | `[enabled]`                                                    |
| admin    | `/stay`           | —                  | `[enabled]`                                                    |
| admin    | `/voteskip`       | —                  | `[enabled] [threshold]`                                        |
| audio    | `/bassboost`      | —                  | `[enabled]`                                                    |
| audio    | `/8d`             | `eightd`           | `[enabled]`                                                    |
| audio    | `/equalizer`      | `eq`               | `<preset>`                                                     |
| audio    | `/filters`        | —                  | `show, reset`                                                  |
| audio    | `/karaoke`        | —                  | `[enabled]`                                                    |
| audio    | `/lowpass`        | —                  | `[enabled]`                                                    |
| audio    | `/nightcore`      | —                  | `[enabled]`                                                    |
| audio    | `/pitch`          | —                  | `<value>`                                                      |
| audio    | `/rate`           | —                  | `<value>`                                                      |
| audio    | `/rotation`       | —                  | `[enabled]`                                                    |
| audio    | `/speed`          | —                  | `<value>`                                                      |
| audio    | `/tremolo`        | —                  | `[enabled]`                                                    |
| audio    | `/vaporwave`      | —                  | `[enabled]`                                                    |
| audio    | `/vibrato`        | —                  | `[enabled]`                                                    |
| audio    | `/volume`         | `vol`              | `<percent>`                                                    |
| extras   | `/about`          | —                  | —                                                              |
| extras   | `/favorites`      | `favorite`, `fav`  | `add, remove, list, play`                                      |
| extras   | `/grab`           | `save`             | —                                                              |
| extras   | `/help`           | —                  | `[category]`                                                   |
| extras   | `/history`        | —                  | `[page]`                                                       |
| extras   | `/invite`         | —                  | —                                                              |
| extras   | `/lyrics`         | —                  | —                                                              |
| extras   | `/ping`           | —                  | —                                                              |
| extras   | `/playlists`      | `playlist`, `pl`   | `create, delete, add, remove, view, list, play, import, share` |
| extras   | `/stats`          | —                  | —                                                              |
| extras   | `/support`        | —                  | —                                                              |
| playback | `/forward`        | —                  | `<seconds>`                                                    |
| playback | `/join`           | —                  | —                                                              |
| playback | `/leave`          | `disconnect`, `dc` | —                                                              |
| playback | `/pause`          | —                  | —                                                              |
| playback | `/play`           | `p`                | `[query] [attachment]`                                         |
| playback | `/playnext`       | —                  | `[query] [attachment]`                                         |
| playback | `/playnow`        | `forceplay`        | `[query] [attachment]`                                         |
| playback | `/previous`       | `prev`             | —                                                              |
| playback | `/replay`         | —                  | —                                                              |
| playback | `/resume`         | —                  | —                                                              |
| playback | `/rewind`         | —                  | `<seconds>`                                                    |
| playback | `/search`         | —                  | `<query>`                                                      |
| playback | `/seek`           | —                  | `<time>`                                                       |
| playback | `/skip`           | —                  | `[count]`                                                      |
| playback | `/skipto`         | `jump`             | `<position>`                                                   |
| playback | `/stop`           | —                  | —                                                              |
| queue    | `/autoplay`       | —                  | `<enabled>`                                                    |
| queue    | `/clear`          | —                  | —                                                              |
| queue    | `/dedupe`         | —                  | —                                                              |
| queue    | `/loop`           | —                  | `<mode>`                                                       |
| queue    | `/move`           | —                  | `[from] [to]`                                                  |
| queue    | `/nowplaying`     | `np`               | —                                                              |
| queue    | `/queue`          | `q`                | `[page]`                                                       |
| queue    | `/remove`         | —                  | `<positions>`                                                  |
| queue    | `/shuffle`        | —                  | —                                                              |
| queue    | `/swap`           | —                  | `<first> <second>`                                             |
| queue    | `/undo`           | —                  | —                                                              |

## Examples

```text
!play artist - song
!play https://open.spotify.com/playlist/PLAYLIST_ID
!playnext song title
!forceplay song title
!search song title
!seek 1:23
!forward 15
!skip 2
!jump 3
!remove 2,4-6
!move 2 5
!move
!loop queue
!nightcore on
!speed 1.1
!equalizer vocal
!filters reset
!favorites add
!favorites remove 1
!favorites play
!playlists create "Road Trip"
!playlists add "Road Trip" current
!playlists add "Road Trip" queue:2
!playlists add "Road Trip" artist - song
!playlists import "Road Trip" https://www.youtube.com/playlist?list=PLAYLIST_ID
!playlists remove "Road Trip" 2-4
!playlists view "Road Trip" 2
!playlists play "Road Trip"
!playlists share "Road Trip" on
!playlists view READ_ONLY_SHARE_TOKEN
!playlists share "Road Trip" off
!djrole @DJ
!musicchannel #music
!voteskip on 60
!clean on 30
!maxtracklength 2h
!blacklist add user USER_ID Reason for the owner record
!blacklist remove user USER_ID
```

Placeholder IDs/tokens in these examples must be replaced with actual public links,
snowflakes, or an issued share token. Prefix changes affect the next message
immediately; the examples assume the default `!` prefix.

`clear` removes upcoming tracks and cancels pending imports while preserving the
current song. Undo restores the previous queue edit for twenty seconds; it does
not restart cancelled imports. `stop` clears playback and imports but retains a
connected player until the idle rule applies. `leave` removes the bot-scoped queue
snapshot and disconnects voice. `volume` updates playback and the stored default;
`defaultvolume` changes the starting volume of future players. Filter presets enable
by default and accept `off` to remove their effect. `filters` without a prefix
subcommand defaults to `show`; slash commands offer `show` and `reset`.

## Registration and Phase 6 integration

Generate/validate command JSON **without loading .env or contacting Discord**:

```powershell
npm run commands:register -- --dry-run
```

Use `--dry-run --output PATH` to save JSON into an existing directory. The compiled
entry supports the same flags:

```powershell
node dist/scripts/register-commands.js --dry-run --output data/commands.json
```

Once real configuration is available, register with:

```powershell
npm run commands:register
npm run commands:register -- --guild YOUR_SERVER_ID
npm run commands:register -- --global
```

Registration bulk-replaces this application's registered command set in the chosen
scope. `DISCORD_GUILD_ID` is the default development scope when configured; otherwise
registration is global. `--global` overrides that default. The script authenticates
the application ID, verifies it against `DISCORD_CLIENT_ID` for the primary token,
and registers the same definitions for configured extra bot accounts. Tokens and
API errors are never printed. No authenticated registration was performed here.

Phase 6 creates `CommandServices` with a ready Discord client, repositories, engine,
lyrics service, registry, view renderer, `VoteSkipService`, bounded catalog-work
semaphore, validated environment, and logger. Create `CommandHandler` and
`InteractionRouter`, connect the renderer to them, and then install events. Forward
chat-input interactions to `handleInteraction`, human guild messages to
`handleMessage`, and recognized components to `InteractionRouter.handle`.
Controller actions call `invokeComponent`, which reuses parsing, guards, cooldowns,
and the executor. Pagination may defer updates; controls/search choices defer private
replies. One-shot search sessions should set `once:true` and a 60-second lifetime.

During shutdown, call `handler.beginShutdown()` to stop accepting input and abort
catalog/attachment work, stop UI/router timers, close the player manager so pending
playback imports checkpoint and release their callers, then `await handler.close()`
before closing the database. Existing private playlists remain unchanged when a
metadata import is cancelled before its atomic append.

## Verification

The local registration dry run validates all 68 builders. The compiled ESM framework
and compiled registration entry also work without credentials. Strict TypeScript,
ESLint, Prettier, and the production build pass.

**92 temporary command checks** cover every executor through both actual handlers
against a real SQLite database and the real music engine with a fake audio transport.
They also cover schemas for every subcommand, aliases, quote/time/boolean parsing,
DJ/admin/voice policies, requester skip, vote thresholds, stale playback IDs,
blacklists, missing permissions, stages, private replies, opaque sessions,
simultaneous clicks, search reauthorization, favorites, playlist ownership/sharing,
all server settings, and shutdown cancellation. The **48 Phase 4 engine checks**
also pass after the command-driven engine changes.

These are local behavioral checks with stand-in Discord objects; they do not prove
live Discord interaction delivery, voice playback, or upstream account access.
Phase 6 supplies the actual renderer and bootstrap. Phase 7 promotes the regression
coverage into the permanent `tests/` suite. Temporary fixtures remain ignored under
`data/phase-5-verification`. No dependencies changed in Phase 5.

## API references

- [Discord application commands](https://docs.discord.com/developers/interactions/application-commands)
- [Discord permissions](https://docs.discord.com/developers/topics/permissions)
- [discord.js 14.27.0 interaction API](https://discord.js.org/docs/packages/discord.js/14.27.0/ChatInputCommandInteraction:Class)
