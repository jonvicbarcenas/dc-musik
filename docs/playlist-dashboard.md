# Browser playlist manager

Music Room is served by the bot at `/` on `HEALTH_PORT` (3000 by default). It edits the same personal playlists as `/playlists` in Discord. Each person signs in with their own Discord account and can only edit their own library.

## Setup

1. Open the bot's application in the [Discord Developer Portal](https://discord.com/developers/applications), then open **OAuth2**.
2. Add `http://localhost:3000/auth/callback` under **Redirects** for local use. For Railway, use `https://YOUR-BOT-DOMAIN/auth/callback` instead. The redirect must match the dashboard origin exactly, including its port.
3. Copy the OAuth2 client secret into `DISCORD_CLIENT_SECRET` in `.env` or the bot service's environment. This is separate from `DISCORD_TOKEN`; keep both private.
4. Set `DASHBOARD_URL=http://localhost:3000` locally, or `DASHBOARD_URL=https://YOUR-BOT-DOMAIN` on Railway. Use the exact origin you will open in the browser, with no path. If you change `HEALTH_PORT`, update the local URL and redirect too.
5. Run `npm run dev`, or `npm run build` followed by `npm start`. Open the dashboard URL and choose **Connect with Discord**.

The dashboard uses the existing HTTP port, SQLite database, and Lavalink search system. It needs no separate frontend hosting service or database migration. `/health` and `/live` continue to work for deployment health checks. For Railway, expose the bot service's HTTP port (3000 by default) and deploy the updated bot build, then set the two environment variables above.

Without `DISCORD_CLIENT_SECRET`, the home page displays setup guidance and private library APIs remain inaccessible. Discord sign-in requests only the `identify` scope. The application client ID must be the same ID already configured in `DISCORD_CLIENT_ID`.

## Features

- Open **Live queue** to manage the active bot in the Discord voice channel you have joined. If a matching session exists at sign-in, it opens automatically.
- View the current song and progress; pause, resume, set volume, or skip (including vote skip when enabled).
- Drag, remove, shuffle, deduplicate, or clear upcoming songs without interrupting the current song. Undo the last queue edit within twenty seconds, provided playback has not advanced.
- Add search results, public source links, or a saved personal playlist directly to the live Discord queue. Save the current song and upcoming queue as a new personal playlist.

- Create, rename, and delete personal playlists.
- Search Spotify, YouTube Music, YouTube, or SoundCloud by song title or artist and add results to a saved playlist or live queue.
- Import public Spotify, YouTube, or SoundCloud links using the bot's existing source support and limits.
- Drag a track's handle to reorder. Arrow buttons also work with a keyboard or on mobile.
- Filter the playlist by title or artist. Select multiple songs to remove them together.
- Shuffle, remove duplicate songs, and export playlist metadata as JSON.
- Create or revoke the bot's read-only share token. Share tokens work with `/playlists view` and `/playlists play` in Discord.
- Copy a Discord playback command. Join a voice channel and run the command to queue the saved playlist; browser audio playback is not part of this editor.

Edits save immediately. Refresh the playlist to load changes made elsewhere. If its tracklist changed since you opened it, a reorder or removal is rejected and the latest list is loaded, so a stale browser cannot remove newly added songs. The import operation appends tracks; importing a JSON export is not currently supported.

Search and imports require a ready music bot and a working Lavalink node. Spotify import has the same authorization and availability requirements as the Discord commands. Search results expire after ten minutes; search again if adding an old result fails.

## Spotify catalog search

Choose **Spotify** in the search panel's **Search on** dropdown. The bot service must have `SPOTIFY_ENABLED=true`, `SPOTIFY_CLIENT_ID`, and `SPOTIFY_CLIENT_SECRET` configured from its Spotify developer application. These credentials are separate from Discord OAuth. Deploy variable changes on Railway before retrying. Existing Spotify credentials used for imports can be reused; search also supports the existing optional Spotify refresh-token authorization.

Spotify search reads track metadata from the official Web API, up to ten results per search. Spotify results retain their Spotify identity, artwork, album, and duration when added. The existing engine finds a full-length audio match for Discord playback. Search does not use preview clips or need a Spotify source enabled on the Lavalink service. If Spotify configuration or API access is unavailable, the panel displays the error and lets you choose another search source.

See Spotify's [search reference](https://developer.spotify.com/documentation/web-api/reference/search) for API access and current search limits.

## Runtime and access

The live queue refreshes every five seconds while the view is visible and idle. Editing pauses automatic refresh until the interaction finishes. Songs added or advanced from Discord appear on the next refresh. Stale reorder/removal requests are rejected by entry ID, and stale pause/skip buttons cannot control the next song.

Live queues are visible only while your signed-in Discord account shares that bot's voice channel. Writes refresh your member roles and recheck voice membership inside the player's serialized operation. The same DJ/Manage Server rules, account/server blacklists, queue limits, and vote-skip counts used by Discord commands apply. When a DJ role is configured, other listeners can follow the queue and use permitted vote skip. Leaving voice removes access. The dashboard uses the bot's existing gateway voice state, so its OAuth scope remains `identify`.

Saved playlists and the live queue are separate: editing a personal playlist changes the saved library; **Add saved playlist** appends its songs to the active session. Live queue edits affect upcoming playback immediately and do not rewrite the original personal playlist. The current song appears above the editable list.

The dashboard currently runs in the normal single-process entry point (`npm start` / `npm run dev`), including deployments with extra bot accounts. The optional `npm run start:sharded` supervisor continues to expose health checks only; use the normal entry point for the dashboard.

Sessions and pending OAuth states stay in server memory. A restart signs everyone out. Sessions expire after eight hours; search selections are private to that session. Discord access tokens are used only during sign-in and are not saved in the database or sent to the browser. Requests that edit a playlist require both the matching origin and a session CSRF token. Public deployments must use HTTPS. This dashboard expects a single bot service instance with the existing durable SQLite volume.

OAuth follows Discord's [authorization code flow](https://docs.discord.com/developers/topics/oauth2#authorization-code-grant). Register the callback on the same application as the bot; do not enable a separate authorization requirement for bot installation.
