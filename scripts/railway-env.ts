import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigurationError, loadEnv } from '../src/config/env.js';
import { SpotifyUserAuth } from '../src/lib/music/SpotifyUserAuth.js';
import { SafeHttpClient } from '../src/lib/security/SafeHttpClient.js';

async function save(name: string, values: Readonly<Record<string, string>>): Promise<void> {
  const destination = resolve('data/railway', name);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const text =
    Object.entries(values)
      .map(([key, value]) => {
        if (/[\r\n\0]/.test(value)) throw new Error('Unsupported multi-line variable.');
        // dotenv quoting preserves passwords and literal reference variables for Railway's Raw Editor.
        return `${key}=${JSON.stringify(value)}`;
      })
      .join('\n') + '\n';
  try {
    await writeFile(temporary, text, { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(
      'npm run railway:env   Write private bot.env, lavalink.env and cipher.env under ignored data/railway.',
    );
    console.log(
      'Paste each file into the matching Railway service Variables > Raw Editor. Values are never printed.',
    );
    return;
  }
  if (args.length) throw new Error('Use npm run railway:env or --help.');
  const env = loadEnv();
  if (!env.LAVALINK_PASSWORD)
    throw new Error('Set LAVALINK_PASSWORD for the Railway audio service.');
  const password = env.LAVALINK_PASSWORD;
  const cipherPassword = env.YOUTUBE_CIPHER_PASSWORD ?? password;
  await mkdir('data/railway', { recursive: true, mode: 0o700 });
  const bot: Record<string, string> = {
    NODE_ENV: 'production',
    LOG_PRETTY: 'false',
    LOG_LEVEL: env.LOG_LEVEL,
    DISCORD_TOKEN: env.DISCORD_TOKEN,
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: env.DISCORD_GUILD_ID ?? '',
    OWNER_IDS: env.OWNER_IDS.join(','),
    EXTRA_BOT_TOKENS: JSON.stringify(env.EXTRA_BOT_TOKENS),
    SHARD_COUNT: '1',
    RAILWAY_RUN_UID: '0',
    RAILWAY_DOCKERFILE_PATH: 'Dockerfile',
    PORT: '3000',
    HEALTH_PORT: '3000',
    DATABASE_PATH: '/app/persist/music.sqlite',
    MEDIA_CACHE_PATH: '/app/persist/media',
    MEDIA_BRIDGE_PORT: '3001',
    MEDIA_BRIDGE_BIND: '::',
    MEDIA_BRIDGE_PUBLIC_URL: 'http://${{bot.RAILWAY_PRIVATE_DOMAIN}}:3001',
    LAVALINK_HOST: '${{lavalink.RAILWAY_PRIVATE_DOMAIN}}',
    LAVALINK_PORT: '2333',
    LAVALINK_SECURE: 'false',
    LAVALINK_PASSWORD: password,
    LAVALINK_NODES: '[]',
    REDIS_URL: '',
    SOURCE_COUNTRY_CODE: env.SOURCE_COUNTRY_CODE,
    SPOTIFY_ENABLED: String(env.SPOTIFY_ENABLED),
    SPOTIFY_CLIENT_ID: env.SPOTIFY_CLIENT_ID ?? '',
    SPOTIFY_CLIENT_SECRET: env.SPOTIFY_CLIENT_SECRET ?? '',
    SPOTIFY_REFRESH_TOKEN:
      (await new SpotifyUserAuth(env, new SafeHttpClient()).refreshToken()) ?? '',
    DEFAULT_PREFIX: env.DEFAULT_PREFIX,
    DEFAULT_LANGUAGE: env.DEFAULT_LANGUAGE,
    DEFAULT_VOLUME: String(env.DEFAULT_VOLUME),
    MAX_QUEUE_SIZE: String(env.MAX_QUEUE_SIZE),
    MAX_PLAYLIST_IMPORT: String(env.MAX_PLAYLIST_IMPORT),
    MAX_TRACK_LENGTH_SECONDS: String(env.MAX_TRACK_LENGTH_SECONDS),
    SPONSORBLOCK_ENABLED: String(env.SPONSORBLOCK_ENABLED),
  };
  const lavalink: Record<string, string> = {
    RAILWAY_DOCKERFILE_PATH: 'lavalink/Dockerfile',
    PORT: '2333',
    LAVALINK_BIND_ADDRESS: '::',
    LAVALINK_PASSWORD: password,
    JAVA_TOOL_OPTIONS: '-Xms128m -Xmx512m',
    SOURCE_COUNTRY_CODE: env.SOURCE_COUNTRY_CODE,
    YOUTUBE_CIPHER_URL: 'http://${{cipher.RAILWAY_PRIVATE_DOMAIN}}:8001',
    YOUTUBE_CIPHER_PASSWORD: cipherPassword,
    YOUTUBE_OAUTH_ENABLED: String(env.YOUTUBE_OAUTH_ENABLED),
    YOUTUBE_OAUTH_REFRESH_TOKEN: env.YOUTUBE_OAUTH_REFRESH_TOKEN ?? '',
    YOUTUBE_OAUTH_SKIP_INITIALIZATION: String(Boolean(env.YOUTUBE_OAUTH_REFRESH_TOKEN)),
    YOUTUBE_PO_TOKEN: env.YOUTUBE_PO_TOKEN ?? '',
    YOUTUBE_VISITOR_DATA: env.YOUTUBE_VISITOR_DATA ?? '',
  };
  const forwarded = [
    'SPOTIFY_ENABLED',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_SP_DC',
    'SPOTIFY_TOKEN_ENDPOINT',
    'APPLE_MUSIC_ENABLED',
    'APPLE_MUSIC_TOKEN',
    'DEEZER_ENABLED',
    'DEEZER_ARL',
    'DEEZER_MASTER_DECRYPTION_KEY',
    'YANDEX_MUSIC_ENABLED',
    'YANDEX_MUSIC_ACCESS_TOKEN',
    'YOUTUBE_PLAYLIST_PAGES',
    'SPOTIFY_PLAYLIST_PAGES',
    'SPOTIFY_ALBUM_PAGES',
    'APPLE_MUSIC_PLAYLIST_PAGES',
    'APPLE_MUSIC_ALBUM_PAGES',
    'YANDEX_PLAYLIST_PAGES',
    'YANDEX_ALBUM_PAGES',
    'YANDEX_ARTIST_PAGES',
    'YOUTUBE_LYRICS_ENABLED',
    'SPOTIFY_LYRICS_ENABLED',
    'DEEZER_LYRICS_ENABLED',
    'YANDEX_LYRICS_ENABLED',
    'LAVALINK_SOURCE_SOCKET_TIMEOUT_MS',
  ] as const;
  for (const key of forwarded) {
    lavalink[key] = env[key] === undefined ? '' : String(env[key]);
    bot[key] = lavalink[key]!;
  }
  const preferences = [
    'EMBED_COLOR',
    'SUPPORT_URL',
    'AUTO_LEAVE_TIMEOUT_SECONDS',
    'COMMAND_COOLDOWN_MS',
    'CONTROLLER_UPDATE_INTERVAL_MS',
    'IMPORT_CONCURRENCY',
    'MEDIA_MAX_BYTES',
    'MEDIA_REQUEST_TIMEOUT_MS',
    'LAVALINK_RESUME_TIMEOUT_SECONDS',
    'LAVALINK_REQUEST_TIMEOUT_MS',
  ] as const;
  for (const key of preferences) bot[key] = env[key] === undefined ? '' : String(env[key]);
  await save('cipher.env', {
    RAILWAY_DOCKERFILE_PATH: 'lavalink/cipher.Dockerfile',
    PORT: '8001',
    HOST: '::',
    API_TOKEN: cipherPassword,
    MAX_THREADS: '2',
    PREPROCESSED_CACHE_SIZE: '20',
    OVERRIDE_PLAYER_VARIANT: 'IAS',
    XDG_CACHE_HOME: '/tmp/yt-cipher',
  });
  await save('lavalink.env', lavalink);
  await save('bot.env', bot);
  console.log(
    'Prepared private Railway variables: data/railway/bot.env, lavalink.env, cipher.env.',
  );
  console.log(
    'Credentials were not printed. These files stay excluded from Git and Docker builds.',
  );
  console.log(
    'Create services named bot, lavalink and cipher, then paste the matching file into each Raw Editor.',
  );
  console.log(
    'Attach the bot volume at /app/persist before starting it. Stop the local bot before running the cloud copy.',
  );
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'Railway variable export failed. Check configuration and writable data/railway, then retry.',
  );
  process.exitCode = 1;
}
