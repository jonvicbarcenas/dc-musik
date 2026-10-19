import { loadEnv, ConfigurationError } from './config/env.js';
import { createLogger } from './lib/utils/logger.js';
import { openDatabase, applyMigrations, createRepositories } from './lib/db/index.js';
import { MemoryCache, RedisCache } from './lib/cache/Cache.js';
import { MediaBridge } from './lib/security/MediaBridge.js';
import { HealthServer } from './lib/runtime/HealthServer.js';
import { Dashboard } from './lib/web/Dashboard.js';
import { LiveQueue, discordLiveAccount } from './lib/web/LiveQueue.js';
import { MultiBotCoordinator } from './lib/advanced/MultiBotCoordinator.js';
import { createBot } from './bot.js';
import type { BotRuntime } from './bot.js';
import { startupDiagnostic } from './lib/runtime/StartupError.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const shardChild = process.env.DMS_SHARD_CHILD === '1';
  // discord.js reads these process variables itself. 'auto' is a manager setting, not a client count.
  if (!shardChild) {
    process.env.SHARD_COUNT = '1';
    process.env.SHARDS = '[0]';
  }
  const connection = openDatabase(env.DATABASE_PATH);
  const cache = env.REDIS_URL ? new RedisCache(env.REDIS_URL, 'dms:v1', logger) : new MemoryCache();
  const media = new MediaBridge(env);
  const bots: BotRuntime[] = [];
  const coordinator = new MultiBotCoordinator();
  const startupCancellation = new AbortController();
  let pendingBot: Promise<BotRuntime> | null = null;
  let stopping = false;
  let shutdown: Promise<void> | null = null;
  const status = () => ({
    ready:
      !stopping &&
      bots.length === env.EXTRA_BOT_TOKENS.length + 1 &&
      bots.every((bot) => bot.ready()),
    bots: bots.length,
    nodes: bots.reduce((sum, bot) => sum + bot.preparedNodes.size, 0),
  });
  let dashboard: Dashboard | null = null;
  const health = new HealthServer(env.HEALTH_PORT, status, async (request, response) => {
    if (dashboard) await dashboard.handle(request, response);
    else response.writeHead(503).end('Dashboard is starting.');
  });
  let reportTimer: ReturnType<typeof setInterval> | null = null;
  const close = (reason: string, failed = false): Promise<void> => {
    if (shutdown) return shutdown;
    stopping = true;
    startupCancellation.abort();
    coordinator.close();
    logger.info({ reason }, 'Saving queues and stopping.');
    if (failed) process.exitCode = 1;
    shutdown = (async () => {
      if (reportTimer) clearInterval(reportTimer);
      if (process.send) process.send({ type: 'dms:health', ...status() });
      if (pendingBot)
        await pendingBot.then(
          (bot) => {
            if (!bots.includes(bot)) bots.push(bot);
          },
          () => undefined,
        );
      await health.close();
      await dashboard?.close();
      const results = await Promise.allSettled(bots.map((bot) => bot.close()));
      if (results.some((result) => result.status === 'rejected')) {
        process.exitCode = 1;
        logger.error(
          'A final queue checkpoint failed; the preceding durable snapshots are retained.',
        );
      }
      await media.close();
      await cache.close();
      connection.close();
      logger.info('Shutdown complete.');
      if (process.connected) process.disconnect();
    })();
    const timer = setTimeout(() => {
      logger.fatal('Shutdown deadline exceeded; the last durable checkpoints are retained.');
      process.exit(1);
    }, 45_000);
    timer.unref();
    void shutdown.finally(() => clearTimeout(timer)).catch(() => undefined);
    return shutdown;
  };
  const signal = () => {
    void close('signal').catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);
  process.on('message', (message: unknown) => {
    if (
      typeof message === 'object' &&
      message &&
      'type' in message &&
      message.type === 'dms:shutdown'
    )
      signal();
  });
  process.on('unhandledRejection', () => {
    logger.fatal('An unexpected asynchronous failure occurred.');
    void close('unhandledRejection', true);
  });
  process.on('uncaughtException', () => {
    logger.fatal('An unexpected process failure occurred.');
    void close('uncaughtException', true);
  });
  let step = 'Database migrations';
  try {
    applyMigrations(connection);
    step = `Media bridge (port ${env.MEDIA_BRIDGE_PORT})`;
    if (shardChild) await media.initialize();
    else {
      await media.start();
      step = `Health HTTP server (port ${env.HEALTH_PORT})`;
      await health.start();
    }
    step = 'Database repositories';
    const repositories = createRepositories(connection, {
      guildDefaults: {
        prefix: env.DEFAULT_PREFIX,
        defaultVolume: env.DEFAULT_VOLUME,
        maxQueueSize: env.MAX_QUEUE_SIZE,
        maxTrackLengthSeconds: env.MAX_TRACK_LENGTH_SECONDS,
        autoLeaveTimeoutSeconds: env.AUTO_LEAVE_TIMEOUT_SECONDS,
        language: env.DEFAULT_LANGUAGE,
        embedColor: env.EMBED_COLOR,
      },
      limits: { tracksPerPlaylist: env.MAX_PLAYLIST_IMPORT },
    });
    if (!shardChild)
      dashboard = new Dashboard({
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        url: env.DASHBOARD_URL,
        repositories,
        resolver: () => bots.find((bot) => bot.ready())?.services.players.resolver,
        importLimit: env.MAX_PLAYLIST_IMPORT,
        live: new LiveQueue(
          () => bots.map((bot) => discordLiveAccount(bot.services)),
          repositories,
        ),
      });
    const shared = {
      env,
      repositories,
      cache,
      media,
      logger,
      coordinator,
      signal: startupCancellation.signal,
    };
    for (const [index, token] of [env.DISCORD_TOKEN, ...env.EXTRA_BOT_TOKENS].entries()) {
      if (stopping) break;
      step = `Discord account ${index + 1}`;
      pendingBot = createBot(shared, token, index === 0);
      const bot = await pendingBot;
      pendingBot = null;
      if (!bots.includes(bot)) bots.push(bot);
      if (stopping) await bot.close();
    }
    if (shardChild && !stopping) {
      const report = () => {
        if (process.connected && process.send) process.send({ type: 'dms:health', ...status() });
      };
      reportTimer = setInterval(report, 10_000);
      reportTimer.unref();
      report();
    }
    if (!stopping) logger.info('Runtime started. Audio readiness is available at /health.');
  } catch (error) {
    if (stopping && startupCancellation.signal.aborted) {
      await close('startupCancelled');
      return;
    }
    const diagnostic = startupDiagnostic(error, step);
    logger.error({ step: diagnostic.step, code: diagnostic.code }, diagnostic.message);
    await close('startupFailure', true);
  }
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : startupDiagnostic(error, 'Runtime initialization').message,
  );
  process.exitCode = 1;
}
