import { config as loadDotenv } from 'dotenv';
import { isIP } from 'node:net';
import { z } from 'zod';

const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = z.preprocess(blankToUndefined, z.string().trim().optional());
const snowflake = z.string().regex(/^\d{17,20}$/, 'Use a Discord snowflake ID.');
const placeholder = /^(?:replace(?:_|-)|change(?:me|_|-)|your(?:_|-)|example(?:_|-))/i;
const secret = z
  .string()
  .trim()
  .min(16)
  .refine((value) => !placeholder.test(value), {
    message: 'Replace the example value with your own secret.',
  });
const token = secret.min(50).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, {
  message: 'Use a Discord bot token from the Developer Portal.',
});
const optionalSecret = z.preprocess(blankToUndefined, secret.optional());
const optionalSnowflake = z.preprocess(blankToUndefined, snowflake.optional());
const integer = (fallback: number, min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));
const boolean = (fallback: boolean) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? blankToUndefined(value.trim().toLowerCase()) : value),
    z
      .enum(['true', 'false'])
      .default(fallback ? 'true' : 'false')
      .transform((value) => value === 'true'),
  );
const json = <T>(schema: z.ZodType<T>, fallback: string) =>
  z
    .preprocess(blankToUndefined, z.string().default(fallback))
    .transform((value, context): unknown => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: 'custom', message: 'Use valid JSON; values are not logged.' });
        return z.NEVER;
      }
    })
    .pipe(schema);
const hostname = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine(
    (value) =>
      isIP(value) !== 0 ||
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(
        value,
      ),
    'Use a hostname or IP address without a scheme, path, or port.',
  );
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS URL without credentials.');

export const lavalinkNodeSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  host: hostname,
  port: z.number().int().min(1).max(65_535).default(2333),
  authorization: secret,
  secure: z.boolean().default(false),
  retryAmount: z.number().int().min(1).max(1000).default(100),
  retryDelay: z.number().int().min(1000).max(60_000).default(5000),
});

export type LavalinkNodeConfig = z.infer<typeof lavalinkNodeSchema>;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DISCORD_TOKEN: token,
    DISCORD_CLIENT_ID: snowflake,
    DISCORD_GUILD_ID: optionalSnowflake,
    OWNER_IDS: z
      .string()
      .default('')
      .transform((value) => [
        ...new Set(
          value
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ])
      .pipe(z.array(snowflake).max(20)),
    EXTRA_BOT_TOKENS: json(z.array(token).max(10), '[]').refine(
      (values) => new Set(values).size === values.length,
      'Extra bot tokens must be unique.',
    ),
    SHARD_COUNT: z
      .union([z.literal('auto'), z.coerce.number().int().min(1).max(1000)])
      .default('auto'),
    LAVALINK_HOST: hostname.default('127.0.0.1'),
    LAVALINK_PORT: integer(2333, 1, 65_535),
    LAVALINK_PASSWORD: optionalSecret,
    LAVALINK_SECURE: boolean(false),
    LAVALINK_NODES: json(z.array(lavalinkNodeSchema).max(20), '[]'),
    LAVALINK_RESUME_TIMEOUT_SECONDS: integer(120, 30, 3600),
    LAVALINK_REQUEST_TIMEOUT_MS: integer(30_000, 1000, 120_000),
    DATABASE_PATH: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1).default('./data/music.sqlite'),
    ),
    REDIS_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), {
          message: 'Use a redis:// or rediss:// URL.',
        })
        .optional(),
    ),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    LOG_PRETTY: boolean(true),
    DEFAULT_PREFIX: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .refine(
        (value) => !/[\s@<>`]/.test(value),
        'Use a prefix without whitespace, mentions, or backticks.',
      )
      .default('!'),
    EMBED_COLOR: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#5865F2'),
    DEFAULT_LANGUAGE: z.enum(['en', 'tl']).default('en'),
    DEFAULT_VOLUME: integer(80, 1, 200),
    MAX_QUEUE_SIZE: integer(2000, 5, 10_000),
    MAX_PLAYLIST_IMPORT: integer(2000, 5, 10_000),
    MAX_TRACK_LENGTH_SECONDS: integer(7200, 30, 86_400),
    AUTO_LEAVE_TIMEOUT_SECONDS: integer(120, 10, 86_400),
    COMMAND_COOLDOWN_MS: integer(1500, 100, 60_000),
    CONTROLLER_UPDATE_INTERVAL_MS: integer(10_000, 10_000, 60_000),
    IMPORT_CONCURRENCY: integer(3, 1, 8),
    HEALTH_PORT: integer(3000, 1, 65_535),
    MEDIA_BRIDGE_PORT: integer(3001, 1, 65_535),
    MEDIA_CACHE_PATH: z.preprocess(
      blankToUndefined,
      z.string().trim().min(1).default('./media-cache'),
    ),
    MEDIA_BRIDGE_BIND: hostname.default('127.0.0.1'),
    MEDIA_BRIDGE_PUBLIC_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/'
          );
        }, 'Use an HTTP(S) origin without credentials, path, query, or fragment.')
        .default('http://127.0.0.1:3001'),
    ),
    MEDIA_MAX_BYTES: integer(100 * 1024 * 1024, 1024, 1024 * 1024 * 1024),
    MEDIA_REQUEST_TIMEOUT_MS: integer(30_000, 1000, 120_000),
    SUPPORT_URL: z.preprocess(blankToUndefined, httpsUrl.optional()),
    SOURCE_COUNTRY_CODE: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default('PH'),
    SPOTIFY_ENABLED: boolean(false),
    SPOTIFY_PUBLIC_PLAYLIST_FALLBACK: boolean(true),
    SPOTIFY_CLIENT_ID: optionalText,
    SPOTIFY_CLIENT_SECRET: optionalSecret,
    SPOTIFY_REFRESH_TOKEN: optionalSecret,
    SPOTIFY_REDIRECT_URI: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            url.protocol === 'http:' &&
            url.hostname === '127.0.0.1' &&
            Boolean(url.port) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          );
        }, 'Use an explicit http://127.0.0.1:PORT/callback address for local Spotify authorization.')
        .default('http://127.0.0.1:8888/callback'),
    ),
    SPOTIFY_SP_DC: optionalText,
    SPOTIFY_TOKEN_ENDPOINT: z.preprocess(blankToUndefined, httpsUrl.optional()),
    APPLE_MUSIC_ENABLED: boolean(false),
    APPLE_MUSIC_TOKEN: optionalText,
    DEEZER_ENABLED: boolean(false),
    DEEZER_ARL: optionalText,
    DEEZER_MASTER_DECRYPTION_KEY: optionalText,
    YANDEX_MUSIC_ENABLED: boolean(false),
    YANDEX_MUSIC_ACCESS_TOKEN: optionalText,
    YOUTUBE_OAUTH_ENABLED: boolean(false),
    YOUTUBE_OAUTH_REFRESH_TOKEN: optionalText,
    YOUTUBE_OAUTH_SKIP_INITIALIZATION: boolean(false),
    YOUTUBE_CIPHER_URL: z.preprocess(
      blankToUndefined,
      z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/'
          );
        }, 'Use an HTTP(S) cipher origin without credentials, path, query, or fragment.')
        .optional(),
    ),
    YOUTUBE_CIPHER_PASSWORD: optionalSecret,
    YOUTUBE_PO_TOKEN: optionalText,
    YOUTUBE_VISITOR_DATA: optionalText,
    SPONSORBLOCK_ENABLED: boolean(false),
    YOUTUBE_PLAYLIST_PAGES: integer(20, 1, 100),
    SPOTIFY_PLAYLIST_PAGES: integer(20, 1, 100),
    SPOTIFY_ALBUM_PAGES: integer(40, 1, 200),
    APPLE_MUSIC_PLAYLIST_PAGES: integer(7, 1, 100),
    APPLE_MUSIC_ALBUM_PAGES: integer(7, 1, 100),
    YANDEX_PLAYLIST_PAGES: integer(20, 1, 100),
    YANDEX_ALBUM_PAGES: integer(40, 1, 200),
    YANDEX_ARTIST_PAGES: integer(10, 1, 100),
    YOUTUBE_LYRICS_ENABLED: boolean(true),
    SPOTIFY_LYRICS_ENABLED: boolean(false),
    DEEZER_LYRICS_ENABLED: boolean(false),
    YANDEX_LYRICS_ENABLED: boolean(false),
    LAVALINK_SOURCE_SOCKET_TIMEOUT_MS: integer(30_000, 1000, 120_000),
  })
  .superRefine((value, context) => {
    const issue = (key: string, message: string) =>
      context.addIssue({ code: 'custom', path: [key], message });
    if (value.LAVALINK_NODES.length === 0 && !value.LAVALINK_PASSWORD) {
      issue('LAVALINK_PASSWORD', 'Set a Lavalink password or provide LAVALINK_NODES.');
    }
    if (new Set(value.LAVALINK_NODES.map((node) => node.id)).size !== value.LAVALINK_NODES.length) {
      issue('LAVALINK_NODES', 'Each node needs a unique ID.');
    }
    if (value.EXTRA_BOT_TOKENS.includes(value.DISCORD_TOKEN)) {
      issue('EXTRA_BOT_TOKENS', 'Do not repeat the primary bot token.');
    }
    if (value.HEALTH_PORT === value.MEDIA_BRIDGE_PORT) {
      issue('MEDIA_BRIDGE_PORT', 'Health and media bridge ports must differ.');
    }
    if (value.MAX_PLAYLIST_IMPORT > value.MAX_QUEUE_SIZE) {
      issue('MAX_PLAYLIST_IMPORT', 'The import limit must not exceed the queue limit.');
    }
    if (value.SPOTIFY_ENABLED && (!value.SPOTIFY_CLIENT_ID || !value.SPOTIFY_CLIENT_SECRET)) {
      issue('SPOTIFY_ENABLED', 'Enable Spotify only after setting its client ID and secret.');
    }
    if (value.SPOTIFY_REFRESH_TOKEN && !value.SPOTIFY_CLIENT_ID) {
      issue(
        'SPOTIFY_CLIENT_ID',
        'A saved Spotify authorization requires its application client ID.',
      );
    }
    if (value.APPLE_MUSIC_ENABLED && !value.APPLE_MUSIC_TOKEN) {
      issue(
        'APPLE_MUSIC_TOKEN',
        'Provide an Apple Music media API token when enabling this source.',
      );
    }
    if (value.DEEZER_ENABLED && (!value.DEEZER_ARL || !value.DEEZER_MASTER_DECRYPTION_KEY)) {
      issue(
        'DEEZER_ENABLED',
        'The optional LavaSrc Deezer source requires its ARL and decryption key.',
      );
    }
    if (value.YANDEX_MUSIC_ENABLED && !value.YANDEX_MUSIC_ACCESS_TOKEN) {
      issue('YANDEX_MUSIC_ACCESS_TOKEN', 'Provide a Yandex token when enabling this source.');
    }
    if (value.SPOTIFY_LYRICS_ENABLED && !value.SPOTIFY_SP_DC) {
      issue('SPOTIFY_SP_DC', 'Spotify lyrics require an explicitly configured cookie.');
    }
    if (value.DEEZER_LYRICS_ENABLED && !value.DEEZER_ARL) {
      issue('DEEZER_ARL', 'Deezer lyrics require an explicitly configured ARL.');
    }
    if (value.YANDEX_LYRICS_ENABLED && !value.YANDEX_MUSIC_ACCESS_TOKEN) {
      issue('YANDEX_MUSIC_ACCESS_TOKEN', 'Yandex lyrics require an explicitly configured token.');
    }
    if (Boolean(value.YOUTUBE_PO_TOKEN) !== Boolean(value.YOUTUBE_VISITOR_DATA)) {
      issue('YOUTUBE_PO_TOKEN', 'Set both poToken and visitorData, or leave both empty.');
    }
    if (
      value.YOUTUBE_OAUTH_ENABLED &&
      value.YOUTUBE_OAUTH_SKIP_INITIALIZATION &&
      !value.YOUTUBE_OAUTH_REFRESH_TOKEN
    ) {
      issue(
        'YOUTUBE_OAUTH_REFRESH_TOKEN',
        'Skipping OAuth initialization requires a refresh token.',
      );
    }
  });

export class ConfigurationError extends Error {
  constructor(
    issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string; code?: string }>,
  ) {
    super(
      `Invalid configuration:\n${issues.map((issue) => `- ${issue.path.map(String).join('.')}: ${issue.code === 'unrecognized_keys' ? 'Remove unrecognized configuration keys.' : issue.message}`).join('\n')}\nSee .env.example. Secret values are never included.`,
    );
    this.name = 'ConfigurationError';
  }
}

export type Env = z.infer<typeof envSchema> & { lavalinkNodes: LavalinkNodeConfig[] };

/** Pure parser: safe to use in tests without reading .env or contacting services. */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) throw new ConfigurationError(result.error.issues);
  const values = result.data;
  const lavalinkNodes =
    values.LAVALINK_NODES.length > 0
      ? values.LAVALINK_NODES
      : [
          lavalinkNodeSchema.parse({
            id: 'primary',
            host: values.LAVALINK_HOST,
            port: values.LAVALINK_PORT,
            authorization: values.LAVALINK_PASSWORD,
            secure: values.LAVALINK_SECURE,
          }),
        ];
  return {
    ...values,
    LOG_PRETTY: values.NODE_ENV === 'development' && values.LOG_PRETTY,
    lavalinkNodes,
  };
}

/** Call at boot; environment variables override .env values. */
export function loadEnv(): Env {
  loadDotenv({ quiet: true });
  return parseEnv(process.env);
}
