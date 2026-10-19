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

- Create, rename, and delete personal playlists.
- Search YouTube or SoundCloud by song title or artist and add results.
- Import public Spotify, YouTube, or SoundCloud links using the bot's existing source support and limits.
- Drag a track's handle to reorder. Arrow buttons also work with a keyboard or on mobile.
- Filter the playlist by title or artist. Select multiple songs to remove them together.
- Shuffle, remove duplicate songs, and export playlist metadata as JSON.
- Create or revoke the bot's read-only share token. Share tokens work with `/playlists view` and `/playlists play` in Discord.
- Copy a Discord playback command. Join a voice channel and run the command to queue the saved playlist; browser audio playback is not part of this editor.

Edits save immediately. Refresh the playlist to load changes made elsewhere. If its tracklist changed since you opened it, a reorder or removal is rejected and the latest list is loaded, so a stale browser cannot remove newly added songs. The import operation appends tracks; importing a JSON export is not currently supported.

Search and imports require a ready music bot and a working Lavalink node. Spotify import has the same authorization and availability requirements as the Discord commands. Search results expire after ten minutes; search again if adding an old result fails.

## Runtime and access

The dashboard currently runs in the normal single-process entry point (`npm start` / `npm run dev`), including deployments with extra bot accounts. The optional `npm run start:sharded` supervisor continues to expose health checks only; use the normal entry point for the dashboard.

Sessions and pending OAuth states stay in server memory. A restart signs everyone out. Sessions expire after eight hours; search selections are private to that session. Discord access tokens are used only during sign-in and are not saved in the database or sent to the browser. Requests that edit a playlist require both the matching origin and a session CSRF token. Public deployments must use HTTPS. This dashboard expects a single bot service instance with the existing durable SQLite volume.

OAuth follows Discord's [authorization code flow](https://docs.discord.com/developers/topics/oauth2#authorization-code-grant). Register the callback on the same application as the bot; do not enable a separate authorization requirement for bot installation.
