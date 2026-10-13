# Deploy dc-musik on Railway

Use the `master` branch of [jonvicbarcenas/dc-musik](https://github.com/jonvicbarcenas/dc-musik).
Create one Railway project with three services named **bot**, **lavalink**, and
**cipher**. All three use the same GitHub repository and keep the repository root
as their Root Directory. Each builds a different Dockerfile.

Railway translates a Compose application into separate services; local bind mounts,
startup dependencies and credentials still need configuring. Follow the steps below
using the [Railway dashboard](https://railway.com/dashboard). Its
[Compose deployment guide](https://docs.railway.com/guides/docker-compose) describes
the same service mapping.

## Prepare the variables on your computer

From this project directory, run:

```powershell
npm run railway:env
```

This creates three **private local files** under `data/railway`. They are excluded
from Git and Docker builds. The exporter reads your `.env` and the latest rotated
Spotify refresh token, without contacting Discord or printing credentials.

| Railway service | Variables → Raw Editor: paste the contents of |
| --------------- | --------------------------------------------- |
| bot             | `data/railway/bot.env`                        |
| lavalink        | `data/railway/lavalink.env`                   |
| cipher          | `data/railway/cipher.env`                     |

Paste each file's contents directly into the matching service's **Variables → Raw
Editor**, then save. The generated files include literal Railway references such
as `${{lavalink.RAILWAY_PRIVATE_DOMAIN}}`; keep those references. The names in the
references match the three service names above. Railway resolves them after all
three services exist. Credentials belong in Variables, never in a repository file.
After changing local account authorization, rerun the exporter and update the
affected Railway variables.

## Create and configure the services

1. Sign in to Railway and choose **New Project → Empty Project**.
2. Add **GitHub Repo** and choose `jonvicbarcenas/dc-musik`, branch `master`.
   Name the service **cipher**. Add the same repository twice more and name those
   services **lavalink** and **bot**. Keep Root Directory at the repository root for
   all three; the Dockerfiles need files from that root.
3. In each service's Settings, use these build/deploy settings:

   | Setting               | bot                    | lavalink               | cipher                       |
   | --------------------- | ---------------------- | ---------------------- | ---------------------------- |
   | Builder               | Dockerfile             | Dockerfile             | Dockerfile                   |
   | Dockerfile Path       | `Dockerfile`           | `lavalink/Dockerfile`  | `lavalink/cipher.Dockerfile` |
   | Custom Start Command  | Leave empty            | Leave empty            | Leave empty                  |
   | Healthcheck Path      | `/health`              | Leave empty            | `/`                          |
   | Healthcheck Timeout   | 600 seconds            | Default                | 120 seconds                  |
   | Serverless / sleeping | Disabled               | Disabled               | Disabled                     |
   | Replicas              | 1                      | 1                      | 1                            |
   | Restart Policy        | On Failure, 10 retries | On Failure, 10 retries | On Failure, 10 retries       |
   | Deployment draining   | 60 seconds             | 20 seconds             | 10 seconds                   |

   If the Dockerfile Path field is unavailable, add `RAILWAY_DOCKERFILE_PATH` in
   Variables with the path from the table. The exporter already includes that variable
   in each private file. The generated `PORT` variable is 3000,
   2333, or 8001 respectively. Leave Build Command and Pre-deploy Command empty:
   Docker performs the build and the bot migrates SQLite at runtime, after its
   volume has been mounted.

   Keep all three in the same region/environment. Singapore is a reasonable first
   choice for a Philippine Discord server if your Railway project offers it.
   Configure a memory limit with room for Java's heap and native audio libraries;
   1 GB for Lavalink is a starting limit, not a measured capacity guarantee. The
   default Java heap is capped at 512 MB. Bot and cipher memory needs depend on
   queue size, uploads and concurrent playback. Measure usage after your first test.

4. Paste the corresponding private variable files using the table above.
5. Add a **Volume** to **bot**, mounted at exactly:

   ```text
   /app/persist
   ```

   Choose an initial size suitable for your uploaded audio, for example 1 GB.
   The exporter sets `DATABASE_PATH=/app/persist/music.sqlite` and
   `MEDIA_CACHE_PATH=/app/persist/media`, so SQLite, queues, libraries, Spotify
   authorization and uploaded audio all use the same persistent volume.
   `RAILWAY_RUN_UID=0` permits the container initializer to set ownership of the
   mounted directory; it immediately drops to the existing `node` user before
   running the bot. See [Railway volume permissions](https://docs.railway.com/volumes#permissions).

6. Deploy **cipher**, then **lavalink**. The cipher logs should report that its
   server is listening. Lavalink should finish loading its plugins and bind to
   port 2333. Lavalink's REST API requires its password, so `/version` is unsuitable
   as an unauthenticated Railway healthcheck; leave that field empty. The bot's
   readiness check verifies its authenticated Lavalink connection.
7. In your local `npm run dev` terminal, press **Ctrl+C** before deploying **bot**.
   Run one copy per Discord account. Deploy **bot** and wait for `/health` to pass.

The images include their configuration and listen on IPv6/IPv4 for Railway's
[private network](https://docs.railway.com/networking/private-networking/library-configuration).
The bot reaches Lavalink on port 2333, Lavalink reaches cipher on 8001, and Lavalink
fetches signed upload URLs from the bot on 3001. Public domains are optional for
these services; their internal connections use Railway's private domains.

## Verify playback

Once bot deployment reports healthy, join a Discord voice channel and try:

```text
!play Hale - Blue Sky
!queue
!np
```

For synchronized lyrics, run `/lyrics` or `!lyrics` while a song is playing. When
the provider supplies timestamps, the karaoke view follows the full song, highlights
the current line and shows nearby lines. Pause and seeking update the same message;
songs with only plain lyrics use pages. No additional Railway variables are needed.

Then test a short complete audio attachment to verify the private media bridge.
Restart the bot service once and confirm a saved favorite/playlist remains available.
A fresh Railway volume begins with an empty database; local saved libraries are
not copied automatically.

For slash commands that have not been registered already, register from your local
computer using the same bot application and server configuration:

```powershell
npm run commands:register
```

The health endpoint verifies Discord login and the authenticated audio-node
connection. It cannot prove that a particular third-party track or Discord voice
stream succeeds; that requires the playback checks above.

## Source authorization

The exporter copies saved YouTube OAuth configuration to Lavalink and Spotify
authorization to bot. Authorize accounts locally with `npm run youtube:auth` or
`npm run spotify:auth`, then regenerate/update the matching private variable file
if access changes. The Spotify helper uses a local callback and runs on your
computer. Lavalink source access can differ on a cloud IP; a failed track still
requires checking the source's actual error privately.

Full imports through Spotify's new playlist API require an authorized owner or
collaborator even for public playlists. [Spotify documents this restriction](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items).
The bot also enables `SPOTIFY_PUBLIC_PLAYLIST_FALLBACK=true` by default. After the
API confirms a playlist is public, a denied first items request can use the unsigned
public embed metadata. This imports up to 100 visible entries and warns that the
full playlist has not been verified. It can change or fail upstream and does not
handle private playlists. Set this variable to `false` in **bot** Variables to use
only the API. Spotify's [terms restrict unauthorized automated retrieval](https://developer.spotify.com/terms#section-iv-restrictions).

## Troubleshooting

| Symptom                           | Check                                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bot health stays pending          | Both other services are running, all service names/references match, Lavalink password matches, and the Discord token/Message Content Intent is correct. |
| `EACCES` while opening data/media | bot volume is mounted at `/app/persist` and `RAILWAY_RUN_UID=0` is present.                                                                              |
| Audio-node connection unavailable | bot `LAVALINK_HOST` references lavalink's private domain, port is 2333, secure is false, and Lavalink listens on `::`.                                   |
| YouTube cipher unavailable        | Lavalink `YOUTUBE_CIPHER_URL` references cipher's private domain on 8001, and its cipher password matches cipher `API_TOKEN`.                            |
| Uploaded audio fails              | bot media bind is `::`, its public URL references bot's private domain on port 3001, and media files use `/app/persist/media`.                           |
| Data disappears after a restart   | Verify the volume mount and the database/media paths before adding more saved content.                                                                   |
| Slash commands missing            | Invite with `applications.commands` and run local command registration for the same application/server.                                                  |

Keep account tokens and raw provider logs private. Railway has
[usage-based pricing](https://docs.railway.com/pricing/plans); the Hobby plan includes
$5 of usage, and extra usage is billed. These steps create paid resources when you
apply/deploy them in your Railway account.

## What has been checked

Type checking, lint, formatting and builds are verified locally. The production
Docker images are checked using an isolated IPv6 Docker network and a disposable
volume, with fixture credentials: cipher authentication, Lavalink readiness, DAVE
library loading, Java WAV decoding, IPv6 health/media HTTP and database/media
persistence across a container restart passed. The bot ran as UID 1000 after its
root initializer corrected the volume ownership. The real Railway deployment and audible Discord
playback still require completing the steps in your Railway account.
