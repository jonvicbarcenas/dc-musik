# Phase 6 — Complete source files

All 62 added or updated production files are reproduced in full, including the runtime guide. Temporary verification fixtures under ignored data/ remain reserved for the permanent test phase.

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/index.ts

````typescript
import { loadEnv, ConfigurationError } from './config/env.js';
import { createLogger } from './lib/utils/logger.js';
import { openDatabase, applyMigrations, createRepositories } from './lib/db/index.js';
import { MemoryCache, RedisCache } from './lib/cache/Cache.js';
import { MediaBridge } from './lib/security/MediaBridge.js';
import { HealthServer } from './lib/runtime/HealthServer.js';
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
  const health = new HealthServer(env.HEALTH_PORT, status);
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
      const results = await Promise.allSettled(bots.map((bot) => bot.close()));
      if (results.some((result) => result.status === 'rejected')) {
        process.exitCode = 1;
        logger.error(
          'A final queue checkpoint failed; the preceding durable snapshots are retained.',
        );
      }
      await health.close();
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/bot.ts

````typescript
import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { Env } from './config/env.js';
import type { Repositories } from './lib/db/contracts.js';
import type { Cache } from './lib/cache/Cache.js';
import type { MediaBridge } from './lib/security/MediaBridge.js';
import type { Logger } from 'pino';
import { createCommandRegistry } from './commands/index.js';
import { CommandHandler } from './framework/CommandHandler.js';
import { InteractionRouter } from './framework/InteractionRouter.js';
import { VoteSkipService } from './framework/VoteSkipService.js';
import { createLavalinkClient, LavalinkTransport } from './lib/music/LavalinkTransport.js';
import { SourceResolver } from './lib/music/SourceResolver.js';
import { CatalogClient } from './lib/music/CatalogClient.js';
import { AutoplayEngine } from './lib/music/AutoplayEngine.js';
import { PlayerManager } from './lib/music/PlayerManager.js';
import { RecoveryManager } from './lib/music/RecoveryManager.js';
import { LyricsService } from './lib/music/LyricsService.js';
import { Semaphore } from './lib/utils/AsyncLock.js';
import { checkVoicePermissions, ensureStageSpeaker } from './lib/utils/permissions.js';
import { CommandPresenter } from './lib/ui/CommandPresenter.js';
import { TaskGroup } from './lib/runtime/TaskGroup.js';
import { installEvents } from './events/index.js';
import { initializeReady } from './events/ready.js';
import type { BotEvents } from './events/types.js';
import type { MultiBotCoordinator } from './lib/advanced/MultiBotCoordinator.js';
import { StartupError, discordStartupError } from './lib/runtime/StartupError.js';

export interface BotShared {
  env: Env;
  repositories: Repositories;
  cache: Cache;
  media: MediaBridge;
  logger: Logger;
  coordinator: MultiBotCoordinator;
  signal?: AbortSignal;
}
export interface BotRuntime extends BotEvents {
  close(): Promise<void>;
  ready(): boolean;
}
export async function createBot(
  shared: BotShared,
  token: string,
  primary: boolean,
): Promise<BotRuntime> {
  const { env, repositories, cache, media, logger, coordinator } = shared;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    allowedMentions: { parse: [] },
  });
  client.on(Events.Error, () => logger.warn('Discord connection reported an error.'));
  client.on(Events.Warn, () => logger.warn('Discord connection reported a warning.'));
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let stopWaiting: () => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    const cancelled = () => reject(new Error('Startup cancelled.'));
    shared.signal?.addEventListener('abort', cancelled, { once: true });
    stopWaiting = () => shared.signal?.removeEventListener('abort', cancelled);
    client.once(Events.ClientReady, () => {
      if (readyTimer) clearTimeout(readyTimer);
      stopWaiting();
      resolve();
    });
    readyTimer = setTimeout(() => reject(new Error('Discord readiness timed out.')), 60_000);
    readyTimer.unref();
  });
  // Attach a rejection observer before login so a gateway timeout cannot become unhandled.
  void ready.catch(() => undefined);
  try {
    shared.signal?.throwIfAborted();
    await Promise.race([client.login(token), ready.then(() => undefined)]);
    await ready;
  } catch (error) {
    if (readyTimer) clearTimeout(readyTimer);
    stopWaiting();
    await client.destroy();
    throw discordStartupError(error, shared.signal?.aborted);
  }
  if (!client.isReady()) throw new Error('Discord is not ready.');
  if (primary && client.user.id !== env.DISCORD_CLIENT_ID) {
    await client.destroy();
    throw new StartupError(
      'DISCORD_APPLICATION_ID',
      'DISCORD_CLIENT_ID does not match the primary bot account. Set it to the application ID from the Developer Portal.',
    );
  }
  const botId = client.user.id;
  let transport: LavalinkTransport | null = null;
  let runtime: BotRuntime | null = null;
  try {
    shared.signal?.throwIfAborted();
    const lavalink = await createLavalinkClient(
      env,
      botId,
      repositories.queueSnapshots,
      (guildId, payload) => {
        client.guilds.cache.get(guildId)?.shard.send(payload);
      },
      (guildId) => client.guilds.cache.has(guildId),
    );
    transport = new LavalinkTransport(lavalink);
    const resolver = new SourceResolver(
      transport,
      cache,
      media,
      new CatalogClient(env),
      env.IMPORT_CONCURRENCY,
    );
    const players = new PlayerManager(
      botId,
      env,
      repositories,
      transport,
      resolver,
      new AutoplayEngine(resolver, repositories.history),
      logger,
    );
    const ui = new CommandPresenter();
    const services = {
      client,
      env,
      repositories,
      players,
      lyrics: new LyricsService(lavalink, cache),
      registry: createCommandRegistry(),
      ui,
      votes: new VoteSkipService(),
      catalogWork: new Semaphore(env.IMPORT_CONCURRENCY),
      logger,
    };
    const handler = new CommandHandler(services);
    const router = new InteractionRouter(handler);
    ui.bind(services, handler, router);
    const recovery = new RecoveryManager(
      players,
      repositories.queueSnapshots,
      async (summary) => {
        const guild = client.guilds.cache.get(summary.guildId);
        if (!guild || !guild.available || (await repositories.blacklist.findMatch(botId, guild.id)))
          return false;
        const channel = await guild.channels.fetch(summary.voiceChannelId);
        if (!channel?.isVoiceBased()) return false;
        const member = await guild.members.fetch(botId);
        checkVoicePermissions(member, channel);
        // Stage readiness is rechecked after a recovered connection, through voice state events.
        if (member.voice.channelId === channel.id) await ensureStageSpeaker(member, channel);
        return true;
      },
      logger,
    );
    const tasks = new TaskGroup(logger);
    const preparedNodes = new Set<string>();
    let closed = false;
    let closing: Promise<void> | null = null;
    const audio = transport;
    runtime = {
      services,
      handler,
      router,
      ui,
      lavalink,
      recovery,
      tasks,
      coordinator,
      preparedNodes,
      ready: () =>
        !closed &&
        client.isReady() &&
        [...lavalink.nodeManager.nodes.values()].some(
          (node) => node.connected && node.sessionId && node.info && preparedNodes.has(node.id),
        ),
      close: () => {
        if (closing) return closing;
        closed = true;
        closing = (async () => {
          handler.beginShutdown();
          recovery.stop();
          tasks.beginShutdown();
          detach();
          router.close();
          await ui.close().catch(() => undefined);
          const checkpoints = await players.close().then(
            () => true,
            () => false,
          );
          await handler.close();
          await router.drain();
          await tasks.drain();
          audio.close();
          services.votes.clear();
          await client.destroy();
          if (!checkpoints)
            throw new Error('Final queue checkpoint failed. The preceding snapshots are retained.');
        })();
        return closing;
      },
    };
    coordinator.add(runtime, primary);
    const detach = installEvents(runtime);
    await initializeReady(runtime);
    return runtime;
  } catch (error) {
    if (runtime) await runtime.close().catch(() => undefined);
    else {
      transport?.close();
      await client.destroy();
    }
    throw error;
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/shard.ts

````typescript
import { ShardingManager } from 'discord.js';
import { fileURLToPath } from 'node:url';
import { loadEnv, ConfigurationError } from './config/env.js';
import { createLogger } from './lib/utils/logger.js';
import { MediaBridge } from './lib/security/MediaBridge.js';
import { HealthServer } from './lib/runtime/HealthServer.js';
import type { HealthStatus } from './lib/runtime/HealthServer.js';
import { startupDiagnostic } from './lib/runtime/StartupError.js';

/** One supervisor owns HTTP ports; child shards share SQLite and the authenticated media cache. */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const media = new MediaBridge(env);
  const reports = new Map<number, HealthStatus & { received: number }>();
  let closing = false;
  process.env.DMS_SHARD_CHILD = '1';
  const manager = new ShardingManager(fileURLToPath(new URL('./index.js', import.meta.url)), {
    token: env.DISCORD_TOKEN,
    totalShards: env.SHARD_COUNT,
    mode: 'process',
    respawn: true,
  });
  const health = new HealthServer(env.HEALTH_PORT, () => ({
    ready:
      !closing &&
      manager.shards.size > 0 &&
      reports.size === manager.shards.size &&
      [...reports.values()].every(
        (report) => report.ready && Date.now() - report.received < 35_000,
      ),
    bots: [...reports.values()].reduce((sum, report) => sum + report.bots, 0),
    nodes: [...reports.values()].reduce((sum, report) => sum + report.nodes, 0),
  }));
  manager.on('shardCreate', (shard) => {
    const reset = () => {
      reports.set(shard.id, { ready: false, bots: 0, nodes: 0, received: Date.now() });
    };
    reset();
    shard.on('spawn', reset);
    shard.on('death', reset);
    shard.on('error', () => logger.warn({ shardId: shard.id }, 'Shard process reported an error.'));
    shard.on('message', (message: unknown) => {
      if (
        typeof message !== 'object' ||
        !message ||
        !('type' in message) ||
        message.type !== 'dms:health' ||
        !('ready' in message) ||
        typeof message.ready !== 'boolean' ||
        !('bots' in message) ||
        typeof message.bots !== 'number' ||
        !('nodes' in message) ||
        typeof message.nodes !== 'number'
      )
        return;
      if (
        !Number.isInteger(message.bots) ||
        message.bots < 0 ||
        message.bots > 11 ||
        !Number.isInteger(message.nodes) ||
        message.nodes < 0 ||
        message.nodes > 220
      )
        return;
      reports.set(shard.id, {
        ready: message.ready,
        bots: message.bots,
        nodes: message.nodes,
        received: Date.now(),
      });
    });
  });
  let shutdown: Promise<void> | null = null;
  const close = (): Promise<void> => {
    if (shutdown) return shutdown;
    closing = true;
    manager.respawn = false;
    shutdown = (async () => {
      logger.info('Stopping shard children and saving queues.');
      const exits = [...manager.shards.values()].map(
        (shard) =>
          new Promise<void>((resolve) => {
            if (!shard.process) {
              resolve();
              return;
            }
            shard.once('death', () => resolve());
            void shard.send({ type: 'dms:shutdown' }).catch(() => resolve());
          }),
      );
      let timer: ReturnType<typeof setTimeout> | null = null;
      await Promise.race([
        Promise.all(exits),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 40_000);
        }),
      ]);
      if (timer) clearTimeout(timer);
      for (const shard of manager.shards.values())
        if (shard.process && shard.process.exitCode === null) shard.kill();
      await health.close();
      await media.close();
      logger.info('Shard supervisor stopped.');
    })();
    return shutdown;
  };
  const stop = () => {
    void close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  process.on('unhandledRejection', () => {
    process.exitCode = 1;
    logger.fatal('Shard supervisor failure.');
    stop();
  });
  process.on('uncaughtException', () => {
    process.exitCode = 1;
    logger.fatal('Shard supervisor failure.');
    stop();
  });
  let step = 'Shard media bridge';
  try {
    await media.start();
    step = `Shard health server (port ${env.HEALTH_PORT})`;
    await health.start();
    step = 'Discord shard processes';
    await manager.spawn({ timeout: 90_000 });
  } catch (error) {
    process.exitCode = 1;
    const diagnostic = startupDiagnostic(error, step);
    logger.error({ step: diagnostic.step, code: diagnostic.code }, diagnostic.message);
    await close();
  }
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'Shard supervisor could not start. Check configuration.',
  );
  process.exitCode = 1;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/index.ts

````typescript
import { Events } from 'discord.js';
import type { Guild, GatewayDispatchPayload } from 'discord.js';
import type { QueueSnapshot } from '../lib/db/models.js';
import { installInteractionCreate } from './interactionCreate.js';
import { installMessageCreate } from './messageCreate.js';
import { installVoiceStateUpdate, updateOccupancy } from './voiceStateUpdate.js';
import { installPlayerDisconnect } from './playerDisconnect.js';
import { installLavalinkEvents } from './lavalink.js';
import { installTrackStart } from './trackStart.js';
import { installTrackEnd } from './trackEnd.js';
import { installQueueEnd } from './queueEnd.js';
import type { BotEvents } from './types.js';

export function installEvents(bot: BotEvents): () => void {
  const detach = [
    installInteractionCreate(bot),
    installMessageCreate(bot),
    installVoiceStateUpdate(bot),
    installPlayerDisconnect(bot),
    installLavalinkEvents(bot),
    installTrackStart(bot),
    installTrackEnd(bot),
    installQueueEnd(bot),
  ];
  const raw = (packet: GatewayDispatchPayload) => {
    if (['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'CHANNEL_DELETE'].includes(packet.t))
      void bot.tasks.run(
        () => bot.lavalink.sendRawData(packet as Parameters<typeof bot.lavalink.sendRawData>[0]),
        'voicePacket',
      );
  };
  const changed = (snapshot: QueueSnapshot) => {
    updateOccupancy(bot, snapshot.guildId);
    bot.ui.refresh(snapshot.guildId);
  };
  const notice = (guildId: string, message: string) => {
    void bot.tasks.run(() => bot.ui.notice(guildId, message), 'notice');
  };
  const destroyed = (guildId: string) => {
    void bot.tasks.run(() => bot.ui.end(guildId), 'playerDestroyed');
  };
  const guildDelete = (guild: Guild) => {
    if (!guild.available) return;
    void bot.tasks.run(() => bot.services.players.leave(guild.id), 'guildDelete');
  };
  bot.services.client.on(Events.Raw, raw);
  bot.services.client.on(Events.GuildDelete, guildDelete);
  bot.services.players.on('changed', changed);
  bot.services.players.on('notice', notice);
  bot.services.players.on('destroyed', destroyed);
  return () => {
    for (const remove of detach) remove();
    bot.services.client.off(Events.Raw, raw);
    bot.services.client.off(Events.GuildDelete, guildDelete);
    bot.services.players.off('changed', changed);
    bot.services.players.off('notice', notice);
    bot.services.players.off('destroyed', destroyed);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/interactionCreate.ts

````typescript
import { Events } from 'discord.js';
import type { Interaction } from 'discord.js';
import type { BotEvents } from './types.js';

export function installInteractionCreate(bot: BotEvents): () => void {
  const listener = (interaction: Interaction) => {
    if (interaction.isChatInputCommand())
      void bot.tasks.run(() => bot.coordinator.interaction(bot, interaction), 'interactionCreate');
    else if (interaction.isButton() || interaction.isStringSelectMenu())
      void bot.tasks.run(() => bot.coordinator.component(bot, interaction), 'component');
  };
  bot.services.client.on(Events.InteractionCreate, listener);
  return () => {
    bot.services.client.off(Events.InteractionCreate, listener);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/lavalink.ts

````typescript
import type {
  LavalinkNode,
  TrackStartEvent,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStuckEvent,
} from 'lavalink-client';
import { AsyncLock } from '../lib/utils/AsyncLock.js';
import { observeNodeReady, trackEvent } from '../lib/music/LavalinkTransport.js';
import { forwardTrackError } from './trackError.js';
import { forwardTrackStuck } from './trackStuck.js';
import type { BotEvents } from './types.js';

export function installLavalinkEvents(bot: BotEvents): () => void {
  const lock = new AsyncLock();
  const detachReady = observeNodeReady(
    bot.lavalink,
    async (node) => {
      await bot.tasks.run(
        () =>
          lock.run(async () => {
            try {
              const session = await node.updateSession(
                true,
                bot.services.env.LAVALINK_RESUME_TIMEOUT_SECONDS,
              );
              if (!session || !('resuming' in session) || !session.resuming)
                throw new Error('Session resuming unavailable.');
              bot.preparedNodes.add(node.id);
              bot.services.logger.info({ nodeId: node.id }, 'Audio node ready.');
              await bot.recovery.retryOffline();
            } catch {
              bot.preparedNodes.delete(node.id);
              bot.services.logger.warn({ nodeId: node.id }, 'Audio node initialization deferred.');
            }
          }),
        'nodeReady',
      );
    },
    (nodeId) => {
      bot.preparedNodes.delete(nodeId);
      bot.services.logger.warn({ nodeId }, 'Audio node initialization deferred.');
    },
  );
  const disconnect = (node: LavalinkNode) => {
    bot.preparedNodes.delete(node.id);
    void bot.tasks.run(
      () => lock.run(() => bot.services.players.nodeDisconnected(node.id)),
      'nodeDisconnect',
    );
  };
  const error = (node: LavalinkNode) => {
    bot.services.logger.warn({ nodeId: node.id }, 'Audio node connection unavailable.');
  };
  const seen = new WeakSet<object>();
  const forward = (
    _player: unknown,
    _track: unknown,
    payload: TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent,
  ) => {
    if (seen.has(payload)) return;
    seen.add(payload);
    if (payload.type === 'TrackExceptionEvent') forwardTrackError(bot, payload);
    else if (payload.type === 'TrackStuckEvent') forwardTrackStuck(bot, payload);
    else
      void bot.tasks.run(
        () => bot.services.players.onTrackEvent(trackEvent(payload)),
        payload.type,
      );
  };
  const position = (_old: unknown, player: { guildId: string; position: number }) => {
    void bot.tasks.run(
      () => bot.services.players.updatePosition(player.guildId, player.position),
      'playerUpdate',
    );
  };
  bot.lavalink.nodeManager.on('disconnect', disconnect);
  bot.lavalink.nodeManager.on('error', error);
  bot.lavalink.on('trackStart', forward);
  bot.lavalink.on('trackEnd', forward);
  bot.lavalink.on('queueEnd', forward);
  bot.lavalink.on('trackError', forward);
  bot.lavalink.on('trackStuck', forward);
  bot.lavalink.on('playerUpdate', position);
  let retrying = false;
  const timer = setInterval(() => {
    if (retrying) return;
    retrying = true;
    void bot.tasks.run(async () => {
      try {
        await lock.run(async () => {
          await Promise.allSettled(
            [...bot.lavalink.nodeManager.nodes.values()]
              .filter(
                (node) =>
                  node.connected && node.info && node.sessionId && !bot.preparedNodes.has(node.id),
              )
              .map(async (node) => {
                const id = node.sessionId;
                const session = await node.updateSession(
                  true,
                  bot.services.env.LAVALINK_RESUME_TIMEOUT_SECONDS,
                );
                if (
                  node.connected &&
                  node.sessionId === id &&
                  session &&
                  'resuming' in session &&
                  session.resuming
                )
                  bot.preparedNodes.add(node.id);
              }),
          );
          if (bot.preparedNodes.size) await bot.recovery.retryOffline();
        });
      } finally {
        retrying = false;
      }
    }, 'recoveryRetry');
  }, 30_000);
  timer.unref();
  return () => {
    clearInterval(timer);
    detachReady();
    bot.lavalink.nodeManager.off('disconnect', disconnect);
    bot.lavalink.nodeManager.off('error', error);
    bot.lavalink.off('trackStart', forward);
    bot.lavalink.off('trackEnd', forward);
    bot.lavalink.off('queueEnd', forward);
    bot.lavalink.off('trackError', forward);
    bot.lavalink.off('trackStuck', forward);
    bot.lavalink.off('playerUpdate', position);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/messageCreate.ts

````typescript
import { Events } from 'discord.js';
import type { Message } from 'discord.js';
import type { BotEvents } from './types.js';

export function installMessageCreate(bot: BotEvents): () => void {
  const listener = (message: Message) => {
    void bot.tasks.run(() => bot.coordinator.message(bot, message), 'messageCreate');
  };
  bot.services.client.on(Events.MessageCreate, listener);
  return () => {
    bot.services.client.off(Events.MessageCreate, listener);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/playerDisconnect.ts

````typescript
import type { BotEvents } from './types.js';

export function installPlayerDisconnect(bot: BotEvents): () => void {
  const listener = (player: { guildId: string }) => {
    void bot.tasks.run(async () => {
      // Discord's voiceStateUpdate owns movement/kicks. This event also covers SDK-only disconnects.
      const guild = bot.services.client.guilds.cache.get(player.guildId);
      if (!guild || !guild.members.cache.get(bot.services.players.botId)?.voice.channelId)
        if (bot.services.players.view(player.guildId))
          await bot.services.players.leave(player.guildId);
    }, 'playerDisconnect');
  };
  bot.lavalink.on('playerDisconnect', listener);
  return () => {
    bot.lavalink.off('playerDisconnect', listener);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/queueEnd.ts

````typescript
import type { BotEvents } from './types.js';
import type { QueueSnapshot } from '../lib/db/models.js';
export function installQueueEnd(bot: BotEvents): () => void {
  const listener = (snapshot: QueueSnapshot) => {
    void bot.tasks.run(() => bot.ui.end(snapshot.guildId), 'queueEnd');
  };
  bot.services.players.on('queueEnd', listener);
  return () => {
    bot.services.players.off('queueEnd', listener);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/ready.ts

````typescript
import { ActivityType } from 'discord.js';
import type { BotEvents } from './types.js';
export async function initializeReady(bot: BotEvents): Promise<void> {
  const client = bot.services.client;
  client.user.setActivity(`${bot.services.env.DEFAULT_PREFIX}play · /help`, {
    type: ActivityType.Listening,
  });
  bot.services.players.startCheckpoints();
  await bot.lavalink.init({ id: client.user.id, username: client.user.username });
  bot.services.logger.info(
    { botId: client.user.id, guilds: client.guilds.cache.size },
    'Discord client ready.',
  );
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/trackEnd.ts

````typescript
import type { BotEvents } from './types.js';
import type { QueueSnapshot } from '../lib/db/models.js';
export function installTrackEnd(bot: BotEvents): () => void {
  const listener = (snapshot: QueueSnapshot) => {
    void bot.tasks.run(() => bot.ui.end(snapshot.guildId, snapshot.currentPlaybackId), 'trackEnd');
  };
  bot.services.players.on('trackEnd', listener);
  return () => {
    bot.services.players.off('trackEnd', listener);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/trackError.ts

````typescript
import type { TrackExceptionEvent } from 'lavalink-client';
import type { BotEvents } from './types.js';
import { trackEvent } from '../lib/music/LavalinkTransport.js';
export function forwardTrackError(bot: BotEvents, payload: TrackExceptionEvent): void {
  // Provider exception messages may contain signed URLs. The engine creates the user notice.
  void bot.tasks.run(() => bot.services.players.onTrackEvent(trackEvent(payload)), 'trackError');
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/trackStart.ts

````typescript
import type { BotEvents } from './types.js';
import type { QueueSnapshot } from '../lib/db/models.js';
export function installTrackStart(bot: BotEvents): () => void {
  const listener = (snapshot: QueueSnapshot) => {
    void bot.tasks.run(() => bot.ui.announce(snapshot), 'trackStart');
  };
  bot.services.players.on('trackStart', listener);
  return () => {
    bot.services.players.off('trackStart', listener);
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/trackStuck.ts

````typescript
import type { TrackStuckEvent } from 'lavalink-client';
import type { BotEvents } from './types.js';
import { trackEvent } from '../lib/music/LavalinkTransport.js';
export function forwardTrackStuck(bot: BotEvents, payload: TrackStuckEvent): void {
  void bot.tasks.run(() => bot.services.players.onTrackEvent(trackEvent(payload)), 'trackStuck');
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/types.ts

````typescript
import type { LavalinkManager } from 'lavalink-client';
import type { CommandServices } from '../framework/CommandServices.js';
import type { CommandHandler } from '../framework/CommandHandler.js';
import type { InteractionRouter } from '../framework/InteractionRouter.js';
import type { CommandPresenter } from '../lib/ui/CommandPresenter.js';
import type { RecoveryManager } from '../lib/music/RecoveryManager.js';
import type { TaskGroup } from '../lib/runtime/TaskGroup.js';
import type { MultiBotCoordinator } from '../lib/advanced/MultiBotCoordinator.js';

export interface BotEvents {
  services: CommandServices;
  handler: CommandHandler;
  router: InteractionRouter;
  ui: CommandPresenter;
  lavalink: LavalinkManager;
  recovery: RecoveryManager;
  tasks: TaskGroup;
  coordinator: MultiBotCoordinator;
  preparedNodes: Set<string>;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/events/voiceStateUpdate.ts

````typescript
import { Events } from 'discord.js';
import type { VoiceState } from 'discord.js';
import { AsyncLock } from '../lib/utils/AsyncLock.js';
import { checkVoicePermissions, ensureStageSpeaker } from '../lib/utils/permissions.js';
import type { BotEvents } from './types.js';

export function updateOccupancy(bot: BotEvents, guildId: string): void {
  const snapshot = bot.services.players.view(guildId);
  if (!snapshot) return;
  const channel = bot.services.client.guilds.cache
    .get(guildId)
    ?.channels.cache.get(snapshot.voiceChannelId);
  if (channel?.isVoiceBased())
    bot.services.players.setVoiceOccupancy(
      guildId,
      channel.members.filter((member) => !member.user.bot).size,
    );
}
export function installVoiceStateUpdate(bot: BotEvents): () => void {
  const locks = new Map<string, AsyncLock>();
  const listener = (old: VoiceState, current: VoiceState) => {
    const id = current.guild.id;
    void bot.tasks.run(async () => {
      let lock = locks.get(id);
      if (!lock) {
        lock = new AsyncLock();
        locks.set(id, lock);
      }
      await lock.run(async () => {
        const snapshot = bot.services.players.view(id);
        if (!snapshot) return;
        if (current.id === bot.services.players.botId) {
          // Use the latest cached state: a queued event may already have been superseded.
          const actual = current.guild.members.cache.get(current.id)?.voice;
          if (!actual?.channelId) {
            await bot.services.players.leave(id);
            return;
          }
          if (actual.channelId !== snapshot.voiceChannelId) {
            const channel = actual.channel;
            if (!channel) return;
            const member = await current.guild.members.fetch(current.id);
            checkVoicePermissions(member, channel);
            await bot.services.players.moveVoice(id, actual.channelId, snapshot.textChannelId);
            await ensureStageSpeaker(member, channel);
          } else if (
            actual.channel &&
            (old.channelId !== actual.channelId ||
              (old.suppress !== actual.suppress && actual.suppress))
          ) {
            await ensureStageSpeaker(await current.guild.members.fetch(current.id), actual.channel);
          }
        }
        updateOccupancy(bot, id);
      });
    }, 'voiceStateUpdate');
  };
  bot.services.client.on(Events.VoiceStateUpdate, listener);
  return () => {
    bot.services.client.off(Events.VoiceStateUpdate, listener);
    locks.clear();
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/ui/CommandPresenter.ts

````typescript
import { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import type { Message } from 'discord.js';
import type { CommandContext, CommandReply } from '../../framework/CommandContext.js';
import type { CommandUI, CommandView } from '../../framework/CommandUI.js';
import type { CommandHandler } from '../../framework/CommandHandler.js';
import type {
  InteractionRouter,
  InteractionSessionHandle,
} from '../../framework/InteractionRouter.js';
import { CommandError } from '../../framework/errors.js';
import type { CommandServices } from '../../framework/CommandServices.js';
import type { GuildSettings, QueueSnapshot } from '../db/models.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { checkTextPermissions } from '../utils/permissions.js';
import { cleanText } from '../utils/text.js';
import { translate as t } from '../utils/i18n.js';
import { formatTime } from '../utils/time.js';
import { baseEmbed, nowPlayingEmbed, queueEmbed, viewEmbed } from './embeds.js';
import { controllerButtons, helpMenu } from './components.js';
import { Paginator, replyEditor, responseChannel } from './Paginator.js';
import { MessageEditor } from './MessageEditor.js';

interface Controller {
  guildId: string;
  playbackId: string;
  message: Message | null;
  session: InteractionSessionHandle;
  edit: ((payload: CommandReply) => Promise<void>) | null;
  active: boolean;
}
export class CommandPresenter implements CommandUI {
  private services!: CommandServices;
  private handler!: CommandHandler;
  private router!: InteractionRouter;
  private paginator!: Paginator;
  private editor!: MessageEditor;
  private readonly controllers = new Set<Controller>();
  private readonly announcementLocks = new Map<string, AsyncLock>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private closing = false;
  private readonly cleanup = new Set<ReturnType<typeof setTimeout>>();
  bind(services: CommandServices, handler: CommandHandler, router: InteractionRouter): void {
    this.services = services;
    this.handler = handler;
    this.router = router;
    this.paginator = new Paginator(router);
    this.editor = new MessageEditor(services.env.CONTROLLER_UPDATE_INTERVAL_MS, services.logger);
    this.timer = setInterval(() => {
      for (const guildId of services.players.guildIds()) this.refresh(guildId);
    }, services.env.CONTROLLER_UPDATE_INTERVAL_MS);
    this.timer.unref();
  }
  async present(context: CommandContext, view: CommandView): Promise<void> {
    if (this.closing) throw new CommandError('COOLDOWN', 'The bot is restarting.');
    if (view.kind === 'nowplaying' && view.snapshot.current) {
      context.keepResponse = true;
      await this.controller(
        view.snapshot,
        context.settings,
        (payload) => context.respond(payload),
        context,
      );
    } else if (view.kind === 'queue' || view.kind === 'tracks' || view.kind === 'list') {
      const initial = view.kind === 'queue' ? view.page : view.page.page;
      await this.paginator.open(
        context,
        initial,
        async (fresh, page) => {
          const next = await view.onPage(fresh, Math.max(1, page));
          if (next.kind === 'queue') {
            const result = queueEmbed(next.snapshot, next.page, fresh.settings);
            return { payload: { embeds: [result.embed] }, page: result.page, pages: result.pages };
          }
          if (next.kind !== 'tracks' && next.kind !== 'list')
            throw new CommandError('ARGUMENT', 'This page is unavailable.');
          return {
            payload: { embeds: [viewEmbed(next, fresh.settings, fresh.requester)] },
            page: next.page.page,
            pages: Math.max(1, next.page.totalPages),
          };
        },
        view.kind === 'queue' ? { musicChannel: true } : {},
      );
    } else if (view.kind === 'search') await this.search(context, view);
    else if (view.kind === 'help') await this.help(context, view);
    else if (view.kind === 'lyrics') await this.lyrics(context, view);
    else await context.respond({ embeds: [viewEmbed(view, context.settings, context.requester)] });
  }
  private async search(
    context: CommandContext,
    view: Extract<CommandView, { kind: 'search' }>,
  ): Promise<void> {
    let edit: ((payload: CommandReply) => Promise<void>) | null = null;
    const handle = this.router.register({
      guildId: context.guildId,
      channelId: await responseChannel(context),
      sourceChannelId: context.channel.id,
      userId: context.user.id,
      lifetimeMs: 60_000,
      once: true,
      policy: { voice: 'join', dj: true, musicChannel: true },
      actions: {
        select: async (fresh, values) => {
          if (values.length !== 1 || !/^\d$/.test(values[0] ?? ''))
            throw new CommandError('ARGUMENT', 'Choose one search result.');
          await view.onSelect(fresh, Number(values[0]));
        },
      },
      onExpire: async () => {
        await edit?.({ components: [] });
      },
    });
    try {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(handle.id('select'))
        .setPlaceholder(t(context.settings.language, 'search'))
        .addOptions(
          view.items.slice(0, 10).map((item, index) => ({
            label: cleanText(item.track.title, 100),
            value: String(index),
            description: cleanText(
              `${item.track.artist} · ${item.track.isStream ? 'LIVE' : formatTime(item.track.durationMs)}`,
              100,
            ),
          })),
        );
      const message = await context.respond({
        embeds: [viewEmbed(view, context.settings, context.requester)],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      });
      edit = replyEditor(context, message);
      handle.bind(message.id);
    } catch (error) {
      handle.dispose();
      throw error;
    }
  }
  private async help(
    context: CommandContext,
    view: Extract<CommandView, { kind: 'help' }>,
  ): Promise<void> {
    let edit: ((payload: CommandReply) => Promise<void>) | null = null;
    const render = (fresh: CommandContext, selected = view.selected): CommandReply => {
      const admin =
        this.services.env.OWNER_IDS.includes(fresh.user.id) ||
        fresh.member.permissions.has(PermissionFlagsBits.ManageGuild);
      const entries = view.entries.filter((entry) => entry.category !== 'admin' || admin);
      const available = [...new Set(entries.map((entry) => entry.category))];
      const category = available.includes(selected) ? selected : 'playback';
      return {
        embeds: [
          viewEmbed({ ...view, selected: category, entries }, fresh.settings, fresh.requester),
        ],
        components: helpMenu(handle, available, category, fresh.settings.language),
      };
    };
    const handle = this.router.register({
      guildId: context.guildId,
      channelId: await responseChannel(context),
      sourceChannelId: context.channel.id,
      userId: context.user.id,
      lifetimeMs: 120_000,
      policy: {},
      acknowledgment: 'update',
      actions: {
        category: async (fresh, values) => {
          const selected = view.entries.find((entry) => entry.category === values[0])?.category;
          if (!selected || values.length !== 1)
            throw new CommandError('ARGUMENT', 'Choose a command category.');
          await edit?.(render(fresh, selected));
        },
      },
      onExpire: async () => {
        await edit?.({ components: [] });
      },
    });
    try {
      const message = await context.respond(render(context));
      edit = replyEditor(context, message);
      handle.bind(message.id);
    } catch (error) {
      handle.dispose();
      throw error;
    }
  }
  private async lyrics(
    context: CommandContext,
    view: Extract<CommandView, { kind: 'lyrics' }>,
  ): Promise<void> {
    const playbackId = context.snapshot?.currentPlaybackId;
    const lines = view.lyrics.lines.length
      ? view.lyrics.lines.map((line) => `[${formatTime(line.timestampMs)}] ${line.text}`)
      : view.lyrics.text.split(/\r?\n/);
    const pages: string[] = [];
    let chunk = '';
    for (const line of lines) {
      for (let offset = 0; offset < Math.max(1, line.length); offset += 2000) {
        const section = line.slice(offset, offset + 2000);
        const part = section.trim() ? cleanText(section, 2000) : '';
        if (chunk.length + part.length + 1 > 3000) {
          pages.push(chunk);
          chunk = '';
        }
        chunk += `${part}\n`;
      }
    }
    if (chunk) pages.push(chunk);
    if (!pages.length) pages.push('—');
    await this.paginator.open(
      context,
      1,
      (fresh, requested) => {
        const page = Math.max(1, Math.min(pages.length, requested));
        const position = fresh.snapshot?.positionMs ?? 0;
        const current = view.lyrics.lines.filter((line) => line.timestampMs <= position).at(-1);
        const description = `${pages[page - 1] ?? '—'}${current ? `\n▶ ${cleanText(current.text, 500)}` : ''}`;
        const embed = baseEmbed(fresh.settings)
          .setTitle(`${t(fresh.settings.language, 'lyrics')} · ${cleanText(view.track.title, 170)}`)
          .setDescription(description)
          .setAuthor({
            name: `${view.lyrics.provider} · ${t(fresh.settings.language, 'page', { page, pages: pages.length })}`,
          });
        return Promise.resolve({ payload: { embeds: [embed] }, page, pages: pages.length });
      },
      { musicChannel: true },
      view.lyrics.lines.length
        ? {
            intervalMs: this.services.env.CONTROLLER_UPDATE_INTERVAL_MS,
            active: () => context.snapshot?.currentPlaybackId === playbackId,
          }
        : undefined,
    );
  }
  async announce(snapshot: QueueSnapshot): Promise<void> {
    if (this.closing || !snapshot.current || !snapshot.currentPlaybackId || !snapshot.textChannelId)
      return;
    let lock = this.announcementLocks.get(snapshot.guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.announcementLocks.set(snapshot.guildId, lock);
    }
    await lock.run(async () => {
      if (
        this.closing ||
        this.services.players.view(snapshot.guildId)?.currentPlaybackId !==
          snapshot.currentPlaybackId
      )
        return;
      if (
        [...this.controllers].some(
          (record) =>
            record.active &&
            record.guildId === snapshot.guildId &&
            record.playbackId === snapshot.currentPlaybackId,
        )
      ) {
        this.refresh(snapshot.guildId);
        return;
      }
      const settings = await this.services.repositories.guildSettings.get(snapshot.guildId);
      if (!settings.announceNowPlaying) return;
      const guild = this.services.client.guilds.cache.get(snapshot.guildId);
      const channel =
        guild && snapshot.textChannelId ? await guild.channels.fetch(snapshot.textChannelId) : null;
      if (!channel?.isTextBased() || !channel.isSendable() || !guild) return;
      checkTextPermissions(await guild.members.fetch(this.services.players.botId), channel);
      await this.controller(snapshot, settings, (payload) =>
        channel.send({ ...payload, allowedMentions: { parse: [] } }),
      );
    });
  }
  private async controller(
    snapshot: QueueSnapshot,
    settings: GuildSettings,
    send: (payload: CommandReply) => Promise<Message>,
    context?: CommandContext,
  ): Promise<void> {
    const playbackId = snapshot.currentPlaybackId;
    if (!playbackId || !snapshot.textChannelId) return;
    const invoke = async (fresh: CommandContext, action: string) => {
      const current = this.services.players.view(snapshot.guildId);
      if (current?.currentPlaybackId !== playbackId)
        throw new CommandError('ARGUMENT', 'This track ended. Use the current controller.');
      fresh.expectedPlaybackId = playbackId;
      if (action === 'pause')
        await this.handler.invokeComponent(fresh, current.paused ? 'resume' : 'pause');
      else if (action === 'loop')
        await this.handler.invokeComponent(fresh, 'loop', {
          mode:
            current.loopMode === 'off' ? 'track' : current.loopMode === 'track' ? 'queue' : 'off',
        });
      else if (action === 'quieter' || action === 'louder')
        await this.handler.invokeComponent(fresh, 'volume', {
          percent: Math.max(1, Math.min(200, current.volume + (action === 'louder' ? 10 : -10))),
        });
      else if (action === 'favorite')
        await this.handler.invokeComponent(fresh, 'favorites', {}, 'add');
      else await this.handler.invokeComponent(fresh, action);
    };
    const session = this.router.register({
      guildId: snapshot.guildId,
      channelId: context ? await responseChannel(context) : snapshot.textChannelId,
      sourceChannelId: context?.channel.id ?? snapshot.textChannelId,
      userId: context?.privateResponse ? context.user.id : null,
      lifetimeMs: 86_400_000,
      policy: { voice: 'same', player: true, musicChannel: true },
      actions: Object.fromEntries(
        [
          'previous',
          'pause',
          'skip',
          'stop',
          'shuffle',
          'loop',
          'quieter',
          'louder',
          'queue',
          'favorite',
        ].map((action) => [action, (fresh: CommandContext) => invoke(fresh, action)]),
      ),
      onExpire: async () => {
        if (record) await this.finish(record);
      },
    });
    const record: Controller = {
      guildId: snapshot.guildId,
      playbackId,
      message: null,
      session,
      edit: null,
      active: true,
    };
    this.controllers.add(record);
    try {
      const message = await send({
        embeds: [nowPlayingEmbed(snapshot, settings)],
        components: controllerButtons(session, snapshot, settings.language),
      });
      record.message = message;
      this.editor.register(message.id);
      record.edit = context
        ? replyEditor(context, message)
        : async (payload) => {
            await message.edit({ ...payload, allowedMentions: { parse: [] } });
          };
      session.bind(message.id);
      if (
        this.closing ||
        this.services.players.view(snapshot.guildId)?.currentPlaybackId !== playbackId
      )
        await this.finish(record);
      const older = [...this.controllers].filter(
        (item) => item.active && item.guildId === snapshot.guildId,
      );
      while (older.length > 3) {
        const oldest = older.shift();
        if (oldest) await this.finish(oldest);
      }
    } catch (error) {
      await this.finish(record);
      throw error;
    }
  }
  refresh(guildId: string): void {
    if (this.closing) return;
    for (const record of this.controllers) {
      if (!record.active || record.guildId !== guildId || !record.message) continue;
      this.editor.request(record.message.id, async () => {
        const snapshot = this.services.players.view(guildId);
        if (!record.active || snapshot?.currentPlaybackId !== record.playbackId) return;
        const settings = await this.services.repositories.guildSettings.get(guildId);
        if (!record.active) return;
        await record.edit?.({
          embeds: [nowPlayingEmbed(snapshot, settings)],
          components: controllerButtons(record.session, snapshot, settings.language),
        });
      });
    }
  }
  async end(guildId: string, playbackId?: string | null): Promise<void> {
    await Promise.all(
      [...this.controllers]
        .filter(
          (record) =>
            record.guildId === guildId && (!playbackId || record.playbackId === playbackId),
        )
        .map((record) => this.finish(record)),
    );
  }
  private async finish(record: Controller): Promise<void> {
    if (!record.active) return;
    record.active = false;
    record.session.dispose();
    this.controllers.delete(record);
    if (record.message)
      await this.editor.stop(record.message.id, async () => {
        await record.edit?.({ components: [] });
      });
    if (!this.closing && record.message) {
      const settings = await this.services.repositories.guildSettings.get(record.guildId);
      this.scheduleDelete(record.message, settings);
    }
  }
  private scheduleDelete(message: Message, settings: GuildSettings): void {
    if (!settings.cleanMode || !message.guildId || this.closing) return;
    const timer = setTimeout(() => {
      this.cleanup.delete(timer);
      void message.delete().catch(() => undefined);
    }, settings.cleanAfterSeconds * 1000);
    timer.unref();
    this.cleanup.add(timer);
  }
  async notice(guildId: string, message: string): Promise<void> {
    if (this.closing) return;
    const snapshot = this.services.players.view(guildId);
    const guild = this.services.client.guilds.cache.get(guildId);
    const channel =
      snapshot?.textChannelId && guild ? await guild.channels.fetch(snapshot.textChannelId) : null;
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    const settings = await this.services.repositories.guildSettings.get(guildId);
    const sent = await channel.send({
      embeds: [baseEmbed(settings).setColor(0xfee75c).setDescription(cleanText(message, 3800))],
      allowedMentions: { parse: [] },
    });
    this.scheduleDelete(sent, settings);
  }
  async close(): Promise<void> {
    this.closing = true;
    for (const timer of this.cleanup) clearTimeout(timer);
    this.cleanup.clear();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.paginator.close();
    await Promise.all([...this.controllers].map((record) => this.finish(record)));
    await this.editor.close();
    this.announcementLocks.clear();
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/ui/components.ts

````typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import type { InteractionSessionHandle } from '../../framework/InteractionRouter.js';
import type { CommandCategory } from '../../framework/Command.js';
import type { QueueSnapshot } from '../db/models.js';
import type { Language } from '../utils/i18n.js';
import { translate as t } from '../utils/i18n.js';

export function controllerButtons(
  session: InteractionSessionHandle,
  snapshot: QueueSnapshot,
  language: Language,
) {
  const button = (action: string, emoji: string, label: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder()
      .setCustomId(session.id(action))
      .setEmoji(emoji)
      .setLabel(label)
      .setStyle(style);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('previous', '⏮️', t(language, 'previous')),
      button(
        'pause',
        snapshot.paused ? '▶️' : '⏸️',
        t(language, snapshot.paused ? 'resume' : 'pause'),
        ButtonStyle.Primary,
      ),
      button('skip', '⏭️', t(language, 'skip')),
      button('stop', '⏹️', t(language, 'stop'), ButtonStyle.Danger),
      button('shuffle', '🔀', t(language, 'shuffle')),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button('loop', '🔁', t(language, 'loop')),
      button('quieter', '🔉', '−10%'),
      button('louder', '🔊', '+10%'),
      button('queue', '📜', t(language, 'queue')),
      button('favorite', '❤️', t(language, 'favorite')),
    ),
  ];
}
export function pageButtons(session: InteractionSessionHandle, page: number, pages: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(session.id('back'))
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(session.id('next'))
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages),
    ),
  ];
}
export function helpMenu(
  session: InteractionSessionHandle,
  categories: readonly CommandCategory[],
  selected: CommandCategory,
  language: Language,
) {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(session.id('category'))
        .setPlaceholder(t(language, 'help'))
        .addOptions(
          categories.map((category) => ({
            label: t(language, category),
            value: category,
            default: category === selected,
          })),
        ),
    ),
  ];
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/ui/embeds.ts

````typescript
import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { CommandView } from '../../framework/CommandUI.js';
import type { GuildSettings, QueueSnapshot, Requester, StoredTrack } from '../db/models.js';
import { cleanText, safeWebUrl } from '../utils/text.js';
import { formatTime } from '../utils/time.js';
import { translate as t } from '../utils/i18n.js';
import { progressBar } from '../music/ProgressBar.js';

export const PAGE_SIZE = 10;
const icons: Record<StoredTrack['source'], string> = {
  youtube: '▶️',
  spotify: '🟢',
  soundcloud: '☁️',
  deezer: '🎶',
  applemusic: '🍎',
  yandexmusic: '🎵',
  twitch: '🟣',
  bandcamp: '🎸',
  vimeo: '🎬',
  http: '📁',
  attachment: '📎',
};
export function text(value: string, length = 300): string {
  return escapeMarkdown(cleanText(value, length));
}
export function trackLabel(track: StoredTrack, length = 110): string {
  return `${icons[track.source]} ${text(track.title, length)} — ${text(track.artist, 70)}`;
}
export function baseEmbed(settings: GuildSettings, requester?: Requester): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Number.parseInt(settings.embedColor.slice(1), 16));
  embed.setFooter({
    text: requester
      ? `${t(settings.language, 'requester')} ${cleanText(requester.displayName, 100)} · ${t(settings.language, 'sources')}`
      : t(settings.language, 'sources'),
    ...(requester?.avatarUrl ? { iconURL: requester.avatarUrl } : {}),
  });
  return embed;
}
function artwork(embed: EmbedBuilder, track: StoredTrack): EmbedBuilder {
  const url = track.artworkUrl && safeWebUrl(track.artworkUrl);
  if (url) embed.setThumbnail(url);
  return embed;
}
export function nowPlayingEmbed(snapshot: QueueSnapshot, settings: GuildSettings): EmbedBuilder {
  const current = snapshot.current;
  if (!current)
    return baseEmbed(settings)
      .setTitle(t(settings.language, 'music'))
      .setDescription(t(settings.language, 'empty'));
  const track = current.track;
  const embed = artwork(baseEmbed(settings, current.requester), track)
    .setAuthor({ name: t(settings.language, snapshot.paused ? 'paused' : 'nowPlaying') })
    .setTitle(`${icons[track.source]} ${cleanText(track.title, 240)}`)
    .setDescription(
      `${text(track.artist)}\n\n${progressBar(snapshot.positionMs, current.playable?.durationMs ?? track.durationMs, track.isStream)}`,
    )
    .addFields(
      {
        name: t(settings.language, 'requester'),
        value: text(current.requester.displayName, 100),
        inline: true,
      },
      { name: t(settings.language, 'volume'), value: `${snapshot.volume}%`, inline: true },
      { name: t(settings.language, 'loop'), value: snapshot.loopMode, inline: true },
      {
        name: t(settings.language, 'queue'),
        value: `${snapshot.upcoming.length}${snapshot.autoplay ? ' · 📻' : ''}`,
        inline: true,
      },
    );
  const url = track.uri && safeWebUrl(track.uri);
  if (url) embed.setURL(url);
  const next = snapshot.upcoming[0];
  if (next) embed.addFields({ name: t(settings.language, 'next'), value: trackLabel(next.track) });
  return embed;
}
export function queueEmbed(
  snapshot: QueueSnapshot,
  requested: number,
  settings: GuildSettings,
): { embed: EmbedBuilder; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(snapshot.upcoming.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, requested));
  const start = (page - 1) * PAGE_SIZE;
  const lines = snapshot.upcoming
    .slice(start, start + PAGE_SIZE)
    .map(
      (entry, i) =>
        `**${start + i + 1}.** ${trackLabel(entry.track)} · ${entry.track.isStream ? 'LIVE' : formatTime(entry.track.durationMs)}`,
    );
  const current = snapshot.current ? `**▶ ${trackLabel(snapshot.current.track)}**\n\n` : '';
  const total = snapshot.upcoming.reduce((sum, entry) => sum + entry.track.durationMs, 0);
  const embed = baseEmbed(settings)
    .setTitle(t(settings.language, 'queue'))
    .setDescription(`${current}${lines.join('\n') || t(settings.language, 'empty')}`)
    .addFields({
      name: t(settings.language, 'duration'),
      value: `${formatTime(total)}${snapshot.upcoming.some((entry) => entry.track.isStream) ? ' + LIVE' : ''}`,
    })
    .setAuthor({ name: t(settings.language, 'page', { page, pages }) });
  return { embed, page, pages };
}
export function viewEmbed(
  view: CommandView,
  settings: GuildSettings,
  requester: Requester,
): EmbedBuilder {
  const embed = baseEmbed(settings, requester);
  switch (view.kind) {
    case 'notice':
      return embed
        .setTitle(cleanText(view.title, 256))
        .setDescription(cleanText(view.text, 3800))
        .setColor(
          view.tone === 'warning'
            ? 0xfee75c
            : view.tone === 'success'
              ? 0x57f287
              : Number.parseInt(settings.embedColor.slice(1), 16),
        );
    case 'nowplaying':
      return nowPlayingEmbed(view.snapshot, settings);
    case 'queue':
      return queueEmbed(view.snapshot, view.page, settings).embed;
    case 'track': {
      artwork(embed, view.track)
        .setTitle(cleanText(view.title, 256))
        .setDescription(trackLabel(view.track));
      const url = view.track.uri && safeWebUrl(view.track.uri);
      if (url) embed.setURL(url);
      return embed.addFields({
        name: t(settings.language, 'duration'),
        value: view.track.isStream ? 'LIVE' : formatTime(view.track.durationMs),
      });
    }
    case 'added': {
      const total = view.tracks.reduce((sum, track) => sum + track.durationMs, 0);
      embed
        .setTitle(t(settings.language, 'added'))
        .setDescription(
          `${text(view.name, 160)}\n${view.count}${view.total === null ? '' : ` / ${view.total}`} · ${view.mode}\n\n${view.tracks
            .slice(0, 5)
            .map((track) => trackLabel(track))
            .join('\n')}${view.background ? `\n\n${t(settings.language, 'importing')}` : ''}`,
        )
        .addFields({
          name: t(settings.language, 'duration'),
          value: `${formatTime(total)}${view.background ? ' (first additions)' : ''}`,
        });
      if (view.tracks[0]) artwork(embed, view.tracks[0]);
      return embed;
    }
    case 'tracks':
    case 'list': {
      const { page } = view;
      const start = (page.page - 1) * page.pageSize;
      return embed
        .setTitle(cleanText(view.title, 256))
        .setDescription(
          page.items
            .map(
              (item, i) =>
                `**${start + i + 1}.** ${typeof item === 'string' ? text(item, 260) : trackLabel(item)}`,
            )
            .join('\n') || t(settings.language, 'empty'),
        )
        .setAuthor({
          name: t(settings.language, 'page', {
            page: page.page,
            pages: Math.max(1, page.totalPages),
          }),
        });
    }
    case 'search':
      return embed.setTitle(t(settings.language, 'search')).setDescription(
        `${view.items
          .slice(0, 10)
          .map(
            (item, i) =>
              `**${i + 1}.** ${trackLabel(item.track)} · ${formatTime(item.track.durationMs)}`,
          )
          .join('\n')}\n\n${t(settings.language, 'searchHint')}`,
      );
    case 'lyrics':
      return embed
        .setTitle(`${t(settings.language, 'lyrics')} · ${cleanText(view.track.title, 180)}`)
        .setDescription(view.lyrics.text.slice(0, 3200));
    case 'help':
      return embed
        .setTitle(`${t(settings.language, 'help')} · ${t(settings.language, view.selected)}`)
        .setDescription(
          view.entries
            .filter((entry) => entry.category === view.selected)
            .map(
              (entry) =>
                `**/${entry.name}** · ${text(entry.description, 100)}\n\`${cleanText(entry.usage, 150).replaceAll('`', '')}\``,
            )
            .join('\n\n') || '—',
        );
    case 'settings':
      return embed.setTitle(t(settings.language, 'settings')).setDescription(
        Object.entries(view.values)
          .map(([key, value]) => `**${text(key, 80)}:** ${text(value, 200)}`)
          .join('\n') || '—',
      );
    case 'stats':
      return embed.setTitle(t(settings.language, 'stats')).addFields(
        { name: 'Uptime', value: formatTime(view.uptimeMs), inline: true },
        { name: 'Servers / players', value: `${view.guilds} / ${view.players}`, inline: true },
        {
          name: 'Gateway',
          value: view.gatewayPingMs === null ? '—' : `${view.gatewayPingMs} ms`,
          inline: true,
        },
        {
          name: 'Memory (RSS / heap)',
          value: `${Math.round(view.rssBytes / 1048576)} / ${Math.round(view.heapBytes / 1048576)} MiB`,
          inline: true,
        },
        { name: 'Shards', value: view.shards.join(', ') || '0', inline: true },
      );
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/ui/MessageEditor.ts

````typescript
import type { Logger } from 'pino';

interface PendingEdit {
  latest: (() => Promise<void>) | null;
  running: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  last: number;
  closed: boolean;
}

/** One serialized edit per message per interval; bursts replace the pending render. */
export class MessageEditor {
  private readonly pending = new Map<string, PendingEdit>();
  constructor(
    private readonly intervalMs: number,
    private readonly logger: Logger,
  ) {}

  request(id: string, edit: () => Promise<void>): void {
    let state = this.pending.get(id);
    if (!state) {
      state = { latest: null, running: null, timer: null, last: Date.now(), closed: false };
      this.pending.set(id, state);
    }
    if (state.closed) return;
    state.latest = edit;
    this.schedule(id, state);
  }
  register(id: string): void {
    if (!this.pending.has(id))
      this.pending.set(id, {
        latest: null,
        running: null,
        timer: null,
        last: Date.now(),
        closed: false,
      });
  }
  private schedule(id: string, state: PendingEdit): void {
    if (state.closed || state.timer || state.running || !state.latest) return;
    state.timer = setTimeout(
      () => {
        state.timer = null;
        const edit = state.latest;
        state.latest = null;
        if (!edit || state.closed) return;
        state.running = edit()
          .catch(() => {
            this.logger.warn({ messageId: id }, 'Controller edit could not be delivered.');
          })
          .finally(() => {
            state.last = Date.now();
            state.running = null;
            this.schedule(id, state);
          });
      },
      Math.max(0, this.intervalMs - (Date.now() - state.last)),
    );
    state.timer.unref();
  }
  async stop(id: string, terminal?: () => Promise<void>): Promise<void> {
    const state = this.pending.get(id);
    if (state) {
      state.closed = true;
      state.latest = null;
      if (state.timer) clearTimeout(state.timer);
      await state.running;
      this.pending.delete(id);
    }
    if (terminal) await terminal().catch(() => undefined);
  }
  async close(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((id) => this.stop(id)));
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/ui/Paginator.ts

````typescript
import { MessageFlags } from 'discord.js';
import type { Message } from 'discord.js';
import type { CommandContext, CommandReply } from '../../framework/CommandContext.js';
import type {
  InteractionRouter,
  InteractionSessionHandle,
} from '../../framework/InteractionRouter.js';
import type { CommandPolicy } from '../utils/permissions.js';
import { pageButtons } from './components.js';
import { AsyncLock } from '../utils/AsyncLock.js';

export function replyEditor(
  context: CommandContext,
  message: Message,
): (payload: CommandReply) => Promise<void> {
  return async (payload) => {
    const options = { ...payload, allowedMentions: { parse: [] as [] } };
    if (message.flags.has(MessageFlags.Ephemeral) && context.origin.kind !== 'prefix')
      await context.origin.interaction.webhook.editMessage(message.id, options);
    else await message.edit(options);
  };
}
export async function responseChannel(context: CommandContext): Promise<string> {
  return context.privateResponse && context.origin.kind === 'prefix'
    ? (await context.user.createDM()).id
    : context.channel.id;
}
export interface PageRender {
  payload: CommandReply;
  page: number;
  pages: number;
}

/** Actor-bound menus retain the original guild even when their message is in a DM. */
export class Paginator {
  private readonly sessions = new Set<InteractionSessionHandle>();
  private readonly expirations = new Set<Promise<void>>();
  constructor(private readonly router: InteractionRouter) {}
  async open(
    context: CommandContext,
    initialPage: number,
    render: (context: CommandContext, page: number) => Promise<PageRender>,
    policy: CommandPolicy = {},
    live?: { intervalMs: number; active: () => boolean },
  ): Promise<void> {
    let page = initialPage;
    let edit: ((payload: CommandReply) => Promise<void>) | null = null;
    let expired = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const lock = new AsyncLock();
    const update = async (fresh: CommandContext, requested: number) => {
      await lock.run(async () => {
        if (expired) return;
        const result = await render(fresh, requested);
        if (expired) return;
        page = result.page;
        await edit?.({ ...result.payload, components: pageButtons(handle, page, result.pages) });
      });
    };
    const handle = this.router.register({
      guildId: context.guildId,
      channelId: await responseChannel(context),
      sourceChannelId: context.channel.id,
      userId: context.user.id,
      lifetimeMs: 120_000,
      policy,
      acknowledgment: 'update',
      actions: {
        back: (fresh) => update(fresh, page - 1),
        next: (fresh) => update(fresh, page + 1),
      },
      onExpire: async () => {
        expired = true;
        if (timer) clearInterval(timer);
        this.sessions.delete(handle);
        const done = lock.run(async () => {
          await edit?.({ components: [] });
        });
        this.expirations.add(done);
        try {
          await done;
        } finally {
          this.expirations.delete(done);
        }
      },
    });
    this.sessions.add(handle);
    try {
      const result = await render(context, initialPage);
      page = result.page;
      const message = await context.respond({
        ...result.payload,
        components: pageButtons(handle, page, result.pages),
      });
      edit = replyEditor(context, message);
      handle.bind(message.id);
      if (live) {
        timer = setInterval(() => {
          if (!live.active()) {
            handle.dispose();
            return;
          }
          void update(context, page).catch(() => handle.dispose());
        }, live.intervalMs);
        timer.unref();
      }
    } catch (error) {
      handle.dispose();
      throw error;
    }
  }
  async close(): Promise<void> {
    for (const session of this.sessions) session.dispose();
    this.sessions.clear();
    await Promise.allSettled([...this.expirations]);
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/runtime/HealthServer.ts

````typescript
import { createServer } from 'node:http';
import type { Server } from 'node:http';

export interface HealthStatus {
  ready: boolean;
  bots: number;
  nodes: number;
}
/** Readiness contains aggregate counts only, never guild IDs, sources, or configuration. */
export class HealthServer {
  private server: Server | null = null;
  constructor(
    private readonly port: number,
    private readonly status: () => HealthStatus,
  ) {}
  async start(): Promise<void> {
    const server = createServer((request, response) => {
      if (request.method !== 'GET' || !['/health', '/live'].includes(request.url ?? '')) {
        response.writeHead(404).end();
        return;
      }
      const status = this.status();
      const live = request.url === '/live';
      response
        .writeHead(live || status.ready ? 200 : 503, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        .end(
          JSON.stringify({
            status: live ? 'alive' : status.ready ? 'ready' : 'starting',
            bots: status.bots,
            nodes: status.nodes,
          }),
        );
    });
    server.requestTimeout = 5000;
    server.headersTimeout = 5000;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.port, '0.0.0.0', () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;
  }
  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/runtime/StartupError.ts

````typescript
export class StartupError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StartupError';
  }
}
/** Classify SDK failures into authored messages. Never return raw errors or their causes. */
export function discordStartupError(error: unknown, cancelled = false): StartupError {
  const code: unknown = typeof error === 'object' && error && 'code' in error ? error.code : null;
  const message = error instanceof Error ? error.message : '';
  const status: unknown =
    typeof error === 'object' && error && 'status' in error ? error.status : null;
  if (cancelled) return new StartupError('STARTUP_CANCELLED', 'Discord startup was cancelled.');
  if (code === 'DisallowedIntents' || code === 4014 || message === 'Used disallowed intents')
    return new StartupError(
      'DISCORD_INTENTS',
      'Discord rejected Message Content Intent. Open Developer Portal → your application → Bot → Privileged Gateway Intents, enable Message Content Intent, save, then restart.',
    );
  if (
    status === 401 ||
    code === 'TokenInvalid' ||
    code === 50014 ||
    code === 4004 ||
    message === 'Authentication failed'
  )
    return new StartupError(
      'DISCORD_TOKEN',
      'Discord rejected the bot token. Replace DISCORD_TOKEN with the current token from your application’s Bot page and restart.',
    );
  if (message === 'Sharding is required' || code === 4011)
    return new StartupError(
      'DISCORD_SHARDING',
      'Discord requires sharding for this application. Build the project and run npm run start:sharded.',
    );
  if (message === 'Discord readiness timed out.')
    return new StartupError(
      'DISCORD_TIMEOUT',
      'Discord login timed out. Check gateway connectivity and the application’s enabled intents, then retry.',
    );
  return new StartupError(
    'DISCORD_LOGIN',
    'Discord login failed. Check the token, gateway intents and network access.',
  );
}
export function startupDiagnostic(
  error: unknown,
  step: string,
): { step: string; code: string; message: string } {
  if (error instanceof StartupError) return { step, code: error.code, message: error.message };
  if (error instanceof Error && error.name === 'MigrationError')
    return {
      step,
      code: 'MIGRATIONS',
      message:
        'Database migrations failed. Check the packaged migration files and whether this database was created with a different build.',
    };
  const code: unknown = typeof error === 'object' && error && 'code' in error ? error.code : null;
  if (code === 'EADDRINUSE')
    return {
      step,
      code,
      message: `${step}: the configured port is already in use. Stop the other listener or change the configured port.`,
    };
  if (code === 'EACCES' || code === 'EPERM')
    return {
      step,
      code,
      message: `${step}: permission denied. Check access to the configured data/media directory or listening port.`,
    };
  if (code === 'SQLITE_CANTOPEN' || code === 'SQLITE_READONLY' || code === 'SQLITE_BUSY')
    return {
      step,
      code,
      message: `${step}: SQLite cannot open or write the configured database. Check the data directory permissions and other bot processes.`,
    };
  return {
    step,
    code: 'STARTUP_FAILED',
    message: `${step} failed. Check this step’s configuration and local services. Raw errors are withheld to protect credentials.`,
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/runtime/TaskGroup.ts

````typescript
import type { Logger } from 'pino';
import { errorCode } from '../utils/errors.js';

/** EventEmitter callbacks return immediately; their work remains observable and drainable. */
export class TaskGroup {
  private readonly tasks = new Set<Promise<void>>();
  private closing = false;
  constructor(private readonly logger: Logger) {}
  run(operation: () => Promise<unknown>, event: string): Promise<void> {
    if (this.closing) return Promise.resolve();
    const task = Promise.resolve()
      .then(operation)
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.warn({ event, code: errorCode(error) }, 'Event operation deferred or failed.');
      });
    this.tasks.add(task);
    void task.then(() => this.tasks.delete(task));
    return task;
  }
  beginShutdown(): void {
    this.closing = true;
  }
  async drain(): Promise<void> {
    while (this.tasks.size) await Promise.allSettled([...this.tasks]);
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/advanced/MultiBotCoordinator.ts

````typescript
import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, Message, MessageComponentInteraction } from 'discord.js';
import type { BotEvents } from '../../events/types.js';
import type { Command } from '../../framework/Command.js';
import type { Arguments } from '../../framework/ArgumentParser.js';
import { parseInteraction, parsePrefix } from '../../framework/ArgumentParser.js';
import { prefixBody } from '../../framework/CommandHandler.js';
import { commandErrorMessage } from '../../framework/errors.js';
import { AsyncLock } from '../utils/AsyncLock.js';

interface Account {
  bot: BotEvents;
  primary: boolean;
}
/** Optional accounts share repositories, but players, snapshots and controllers remain bot-scoped.
 * Reservations cover the interval between account selection and completion of a join command. */
export class MultiBotCoordinator {
  private readonly accounts: Account[] = [];
  private readonly lock = new AsyncLock();
  private readonly reservations = new Map<string, { voiceId: string; count: number }>();
  private closing = false;
  add(bot: BotEvents, primary: boolean): void {
    this.accounts.push({ bot, primary });
  }
  private policy(command: Command, args: Arguments) {
    return typeof command.policy === 'function' ? command.policy(args) : command.policy;
  }
  private async select(
    source: BotEvents,
    guildId: string,
    voiceId: string | null,
    command: Command,
    args: Arguments,
  ): Promise<{ bot: BotEvents; release: () => void }> {
    const policy = this.policy(command, args);
    const music =
      (policy.voice !== undefined && policy.voice !== 'none') ||
      (policy.musicChannel && ['queue', 'nowplaying', 'lyrics'].includes(command.name));
    if (!voiceId || !music || !this.accounts.find((account) => account.bot === source)?.primary)
      return { bot: source, release: () => undefined };
    const savedVoices = new Map<string, string>();
    await Promise.all(
      this.accounts.map(async ({ bot }) => {
        if (!bot.services.client.guilds.cache.has(guildId) || bot.services.players.view(guildId))
          return;
        const saved = await bot.services.repositories.queueSnapshots.load(
          bot.services.players.botId,
          guildId,
        );
        if (saved) savedVoices.set(bot.services.players.botId, saved.voiceChannelId);
      }),
    );
    return this.lock.run(() => {
      const candidates = this.accounts.filter(
        ({ bot }) => bot.services.client.isReady() && bot.services.client.guilds.cache.has(guildId),
      );
      const channel = (bot: BotEvents) =>
        bot.services.players.view(guildId)?.voiceChannelId ??
        this.reservations.get(`${bot.services.players.botId}:${guildId}`)?.voiceId ??
        savedVoices.get(bot.services.players.botId) ??
        bot.services.client.guilds.cache.get(guildId)?.members.cache.get(bot.services.players.botId)
          ?.voice.channelId;
      const existing = candidates.find(({ bot }) => channel(bot) === voiceId);
      const chosen =
        existing ??
        (policy.voice === 'join' ? candidates.find(({ bot }) => !channel(bot)) : undefined);
      const bot = chosen?.bot ?? source;
      const key = `${bot.services.players.botId}:${guildId}`;
      if (!chosen || (channel(bot) && channel(bot) !== voiceId))
        return Promise.resolve({ bot: source, release: () => undefined });
      const reservation = this.reservations.get(key) ?? { voiceId, count: 0 };
      reservation.count++;
      this.reservations.set(key, reservation);
      return Promise.resolve({
        bot,
        release: () => {
          reservation.count--;
          if (!reservation.count) this.reservations.delete(key);
        },
      });
    });
  }
  async interaction(source: BotEvents, interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.closing) return;
    if (this.accounts.length <= 1 || !interaction.guildId) {
      await source.handler.handleInteraction(interaction);
      return;
    }
    const command = source.services.registry.get(interaction.commandName);
    if (!command) {
      await source.handler.handleInteraction(interaction);
      return;
    }
    await interaction.deferReply(command.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    try {
      const guild = await source.services.client.guilds.fetch(interaction.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      const choice = await this.select(
        source,
        guild.id,
        member.voice.channelId,
        command,
        parseInteraction(command, interaction),
      );
      try {
        await choice.bot.handler.handleInteraction(interaction);
        if (command.category === 'admin') await this.refreshSettings(choice.bot, guild.id);
      } finally {
        choice.release();
      }
    } catch (error) {
      await interaction
        .editReply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }
  async message(source: BotEvents, message: Message): Promise<void> {
    if (this.closing || !message.inGuild() || message.author.bot || message.webhookId) return;
    const ownMention = new RegExp(`^<@!?${source.services.players.botId}>`).test(message.content);
    const first = this.accounts.find(({ bot }) =>
      bot.services.client.guilds.cache.has(message.guildId),
    );
    if (!ownMention && first?.bot !== source) return;
    if (ownMention || this.accounts.length <= 1) {
      await source.handler.handleMessage(message);
      if (ownMention && this.accounts.length > 1)
        await this.refreshSettings(source, message.guildId);
      return;
    }
    const settings = await source.services.repositories.guildSettings.get(message.guildId);
    const body = prefixBody(message.content, settings.prefix, source.services.players.botId);
    if (body === null) return;
    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(body.trim());
    const command = match ? source.services.registry.get(match[1] ?? '') : undefined;
    if (!command) return;
    try {
      const member = await message.guild.members.fetch(message.author.id);
      const choice = await this.select(
        source,
        message.guildId,
        member.voice.channelId,
        command,
        parsePrefix(command, match?.[2] ?? ''),
      );
      try {
        if (choice.bot === source) await source.handler.handleMessage(message);
        else {
          const guild = await choice.bot.services.client.guilds.fetch(message.guildId);
          const channel = await guild.channels.fetch(message.channelId);
          if (channel?.isTextBased())
            await choice.bot.handler.handleMessage(await channel.messages.fetch(message.id));
        }
      } finally {
        choice.release();
      }
      if (command.category === 'admin') await this.refreshSettings(choice.bot, message.guildId);
    } catch (error) {
      await message
        .reply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
        .catch(() => undefined);
    }
  }
  async component(source: BotEvents, interaction: MessageComponentInteraction): Promise<void> {
    if (this.closing) return;
    const target =
      this.accounts.find(({ bot }) => bot.router.owns(interaction.customId))?.bot ?? source;
    await target.router.handle(interaction);
  }
  private async refreshSettings(source: BotEvents, guildId: string): Promise<void> {
    await Promise.all(
      this.accounts
        .filter(({ bot }) => bot !== source)
        .map(async ({ bot }) => {
          await bot.services.players
            .refreshSettings(guildId)
            .catch(() =>
              source.services.logger.warn(
                { guildId },
                'Another account will refresh settings on recovery.',
              ),
            );
        }),
    );
  }
  close(): void {
    this.closing = true;
    this.reservations.clear();
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/locales/en.json

````json
{
  "music": "Music",
  "nowPlaying": "Now playing",
  "paused": "Paused",
  "requester": "Requested by",
  "volume": "Volume",
  "loop": "Loop",
  "queue": "Queue",
  "next": "Next up",
  "empty": "The queue is empty.",
  "page": "Page {page} of {pages}",
  "duration": "Duration",
  "added": "Added to queue",
  "importing": "The remaining tracks are importing in the background.",
  "search": "Choose a full track",
  "searchHint": "Only the person who searched can select a result. Expires after 60 seconds.",
  "previous": "Previous",
  "pause": "Pause",
  "resume": "Resume",
  "skip": "Skip",
  "stop": "Stop",
  "shuffle": "Shuffle",
  "favorite": "Favorite",
  "expired": "These controls expired. Run the command again.",
  "ended": "Playback ended",
  "live": "LIVE",
  "lyrics": "Lyrics",
  "help": "Command help",
  "settings": "Server settings",
  "stats": "Bot statistics",
  "sources": "Sources: YouTube, SoundCloud and catalog metadata",
  "playback": "Playback",
  "audio": "Audio",
  "extras": "Library and extras",
  "admin": "Server settings"
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/locales/tl.json

````json
{
  "music": "Musika",
  "nowPlaying": "Kasalukuyang tumutugtog",
  "paused": "Naka-pause",
  "requester": "Hiniling ni",
  "volume": "Lakas ng tunog",
  "loop": "Ulit",
  "queue": "Pila",
  "next": "Susunod",
  "empty": "Walang laman ang pila.",
  "page": "Pahina {page} sa {pages}",
  "duration": "Tagal",
  "added": "Idinagdag sa pila",
  "importing": "Idinaragdag pa ang natitirang mga kanta.",
  "search": "Pumili ng buong kanta",
  "searchHint": "Ang naghanap lang ang maaaring pumili. Mag-e-expire sa 60 segundo.",
  "previous": "Nauna",
  "pause": "I-pause",
  "resume": "Ituloy",
  "skip": "Laktawan",
  "stop": "Ihinto",
  "shuffle": "Ihalo",
  "favorite": "Paborito",
  "expired": "Nag-expire na ang mga kontrol. Gamitin muli ang command.",
  "ended": "Natapos ang pagtugtog",
  "live": "LIVE",
  "lyrics": "Mga titik",
  "help": "Gabay sa mga command",
  "settings": "Mga setting ng server",
  "stats": "Estadistika ng bot",
  "sources": "Pinagmulan: YouTube, SoundCloud at metadata ng katalogo",
  "playback": "Pagtugtog",
  "audio": "Tunog",
  "extras": "Mga koleksiyon at iba pa",
  "admin": "Mga setting ng server"
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/i18n.ts

````typescript
import en from '../../locales/en.json' with { type: 'json' };
import tl from '../../locales/tl.json' with { type: 'json' };

export type TranslationKey = keyof typeof en;
export type Language = 'en' | 'tl';
const translations: Record<Language, Record<TranslationKey, string>> = { en, tl };

/** Missing languages fall back to English. User/provider text is never used as a lookup key. */
export function translate(
  language: Language,
  key: TranslationKey,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return translations[language][key].replace(/\{([a-z]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandContext.ts

````typescript
import { MessageFlags, PermissionFlagsBits, escapeMarkdown } from 'discord.js';
import type {
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  Guild,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  MessageCreateOptions,
  User,
  VoiceBasedChannel,
} from 'discord.js';
import type { GuildSettings, QueueEntry, QueueSnapshot, Requester } from '../lib/db/models.js';
import { cleanText, safeWebUrl } from '../lib/utils/text.js';
import { MusicError } from '../lib/utils/errors.js';
import { checkVoicePermissions, ensureStageSpeaker } from '../lib/utils/permissions.js';
import type { AccessFacts, CommandPolicy } from '../lib/utils/permissions.js';
import type { Arguments } from './ArgumentParser.js';
import type { CommandServices } from './CommandServices.js';
import type { CommandView } from './CommandUI.js';
import { CommandError } from './errors.js';

export type CommandOrigin =
  | { kind: 'prefix'; message: Message<true> }
  | { kind: 'slash'; interaction: ChatInputCommandInteraction }
  | { kind: 'component'; interaction: MessageComponentInteraction };
export type CommandReply = Pick<MessageCreateOptions, 'content' | 'embeds' | 'components'>;
export type ContextGuard = (context: CommandContext, policy: CommandPolicy) => Promise<void>;

export class CommandContext {
  public savedSnapshot: QueueSnapshot | null = null;
  public keepResponse = false;
  public privateResponse = false;
  public expectedPlaybackId: string | null = null;
  public readonly responses: Message[] = [];
  constructor(
    public readonly services: CommandServices,
    public readonly origin: CommandOrigin,
    public readonly guild: Guild,
    public readonly channel: GuildTextBasedChannel,
    public readonly user: User,
    public member: GuildMember,
    public settings: GuildSettings,
    public readonly args: Arguments,
    private readonly guard: ContextGuard,
    public readonly signal: AbortSignal = new AbortController().signal,
  ) {}

  get guildId(): string {
    return this.guild.id;
  }
  get botId(): string {
    return this.services.players.botId;
  }
  get createdTimestamp(): number {
    return this.origin.kind === 'prefix'
      ? this.origin.message.createdTimestamp
      : this.origin.interaction.createdTimestamp;
  }
  get requester(): Requester {
    return {
      userId: this.user.id,
      displayName: cleanText(this.member.displayName, 100),
      avatarUrl: safeWebUrl(this.user.displayAvatarURL()),
    };
  }
  get snapshot(): QueueSnapshot | null {
    return this.services.players.view(this.guildId) ?? this.savedSnapshot;
  }
  current(): QueueEntry {
    const current = this.snapshot?.current;
    if (!current) throw new MusicError('NO_PLAYER', 'Nothing is playing.');
    return current;
  }
  requireSnapshot(): QueueSnapshot {
    const snapshot = this.snapshot;
    if (!snapshot)
      throw new MusicError('NO_PLAYER', 'There is no player or saved queue in this server.');
    return snapshot;
  }
  facts(skipCount = 1): AccessFacts {
    const current = this.services.players.view(this.guildId);
    return {
      userId: this.user.id,
      userVoiceId: this.member.voice.channelId,
      playerVoiceId:
        current?.voiceChannelId ??
        this.savedSnapshot?.voiceChannelId ??
        this.guild.members.cache.get(this.botId)?.voice.channelId ??
        null,
      channelId: this.channel.id,
      roleIds: new Set(this.member.roles.cache.keys()),
      manageGuild: this.member.permissions.has(PermissionFlagsBits.ManageGuild),
      owner: this.services.env.OWNER_IDS.includes(this.user.id),
      hasPlayer: current !== null,
      requesterId: current?.current?.requester.userId ?? null,
      skipCount,
    };
  }
  async recheck(policy: CommandPolicy): Promise<void> {
    await this.guard(this, policy);
  }
  present(view: CommandView): Promise<void> {
    return this.services.ui.present(this, view);
  }
  async notice(
    text: string,
    title = 'Music',
    tone: 'success' | 'info' | 'warning' = 'success',
  ): Promise<void> {
    await this.present({ kind: 'notice', title, text, tone });
  }

  async respond(payload: CommandReply): Promise<Message> {
    const options = { ...payload, allowedMentions: { parse: [] as [] } };
    let message: Message;
    if (this.origin.kind === 'prefix') {
      if (this.privateResponse) {
        try {
          message = await this.user.send(options);
        } catch {
          throw new CommandError(
            'PERMISSION',
            'Your DMs are closed. Enable them or use the private slash command.',
          );
        }
      } else message = await this.origin.message.reply(options);
    } else {
      const interaction = this.origin.interaction;
      if (!interaction.deferred && !interaction.replied) await interaction.reply(options);
      else if (this.responses.length) {
        message = await interaction.followUp({
          ...options,
          ...(this.privateResponse || interaction.ephemeral
            ? { flags: MessageFlags.Ephemeral }
            : {}),
        });
        this.responses.push(message);
        return message;
      } else await interaction.editReply(options);
      message = await interaction.fetchReply();
    }
    this.responses.push(message);
    return message;
  }
  async dm(content: string): Promise<void> {
    try {
      await this.user.send({ content, allowedMentions: { parse: [] } });
    } catch {
      throw new CommandError(
        'PERMISSION',
        'Your DMs are closed. Enable direct messages from this server and try again.',
      );
    }
  }
  async privateText(content: string): Promise<void> {
    if (this.origin.kind !== 'prefix') {
      // Personal-library commands are deferred ephemerally by the handler.
      if (this.origin.interaction.ephemeral !== true)
        throw new CommandError(
          'PERMISSION',
          'Use the private slash command to view this information.',
        );
      await this.respond({ content });
      return;
    }
    await this.dm(content);
    await this.notice('I sent the private details to your DMs.');
  }
  async voiceChannel(): Promise<VoiceBasedChannel> {
    const id = this.member.voice.channelId;
    const channel = id ? await this.guild.channels.fetch(id) : null;
    if (!channel?.isVoiceBased())
      throw new CommandError('VOICE', 'Join a voice or stage channel first.');
    const bot = await this.guild.members.fetch(this.botId);
    checkVoicePermissions(bot, channel);
    return channel;
  }
  async joinPlayer(): Promise<QueueSnapshot> {
    await this.recheck({ voice: 'join', dj: true, musicChannel: true });
    const channel = await this.voiceChannel();
    const snapshot = await this.services.players.join(this.guildId, channel.id, this.channel.id);
    await ensureStageSpeaker(await this.guild.members.fetch(this.botId), channel);
    return snapshot;
  }
  async movePlayer(): Promise<void> {
    await this.recheck({ voice: 'move', dj: true, musicChannel: true });
    const channel = await this.voiceChannel();
    if (this.services.players.view(this.guildId))
      await this.services.players.moveVoice(this.guildId, channel.id, this.channel.id);
    else await this.services.players.join(this.guildId, channel.id, this.channel.id);
    await ensureStageSpeaker(await this.guild.members.fetch(this.botId), channel);
  }
  async disconnect(): Promise<void> {
    await this.services.players.leave(this.guildId);
    const bot = await this.guild.members.fetch(this.botId);
    if (bot.voice.channelId) await bot.voice.disconnect();
  }
  async validateRole(id: string | null): Promise<void> {
    if (id && !(await this.guild.roles.fetch(id)))
      throw new CommandError('ARGUMENT', 'That role does not exist in this server.');
  }
  async validateTextChannel(id: string | null): Promise<void> {
    if (!id) return;
    const channel = await this.guild.channels.fetch(id);
    if (!channel?.isTextBased() || !channel.isSendable())
      throw new CommandError('ARGUMENT', 'Choose a text channel or thread in this server.');
  }
  safeName(value: string): string {
    return escapeMarkdown(cleanText(value, 300));
  }
  async acknowledgeError(message: string): Promise<void> {
    if (this.origin.kind === 'prefix' && this.privateResponse) {
      await this.origin.message.reply({ content: message, allowedMentions: { parse: [] } });
      return;
    }
    if (this.origin.kind === 'component' && this.origin.interaction.deferred) {
      await this.origin.interaction.followUp({
        content: message,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }
    await this.respond({ content: message });
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/CommandHandler.ts

````typescript
import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction, MessageComponentInteraction, Message } from 'discord.js';
import { Arguments, parseInteraction, parsePrefix, parseValues } from './ArgumentParser.js';
import type { ArgumentValue } from './ArgumentParser.js';
import type { Command } from './Command.js';
import { CommandContext } from './CommandContext.js';
import type { CommandOrigin } from './CommandContext.js';
import type { CommandServices } from './CommandServices.js';
import { CommandError, commandErrorCode, commandErrorMessage } from './errors.js';
import { Cooldowns } from '../lib/utils/cooldowns.js';
import { authorize, checkTextPermissions } from '../lib/utils/permissions.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export class CommandHandler {
  private readonly cooldowns = new Cooldowns();
  private readonly inFlight = new Set<string>();
  private readonly cleanup = new Set<ReturnType<typeof setTimeout>>();
  private readonly cancellation = new AbortController();
  private readonly active = new Set<Promise<void>>();
  private closing = false;
  constructor(public readonly services: CommandServices) {}

  handleMessage(message: Message): Promise<void> {
    return this.track(() => this.runMessage(message));
  }
  private async runMessage(message: Message): Promise<void> {
    if (message.author.bot || message.webhookId || !message.inGuild()) return;
    let context: CommandContext | null = null;
    try {
      const settings = await this.services.repositories.guildSettings.get(message.guildId);
      const input = prefixBody(message.content, settings.prefix, this.services.players.botId);
      if (input === null) return;
      const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input.trim());
      if (!match) return;
      const command = this.services.registry.get(match[1] ?? '');
      if (!command) return; // Ordinary messages that happen to start with the prefix stay quiet.
      const args = parsePrefix(
        command,
        match[2] ?? '',
        message.attachments.map((file) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          size: file.size,
        })),
      );
      context = await this.context({ kind: 'prefix', message }, args);
      await this.execute(context, command);
    } catch (error) {
      this.log(error);
      if (context)
        await context.acknowledgeError(commandErrorMessage(error)).catch(() => undefined);
      else
        await message
          .reply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
          .catch(() => undefined);
    }
  }

  handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    return this.track(() => this.runInteraction(interaction));
  }
  private async runInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    let context: CommandContext | null = null;
    const command = this.services.registry.get(interaction.commandName);
    try {
      // Acknowledge before member fetches, database I/O, or source requests can exceed three seconds.
      if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({
          ...(command?.ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
        });
      if (!command || command.name !== interaction.commandName)
        throw new CommandError(
          'ARGUMENT',
          'This command changed. Ask the bot owner to register commands again.',
        );
      context = await this.context(
        { kind: 'slash', interaction },
        parseInteraction(command, interaction),
      );
      await this.execute(context, command);
    } catch (error) {
      this.log(error);
      if (context)
        await context.acknowledgeError(commandErrorMessage(error)).catch(() => undefined);
      else if (interaction.deferred)
        await interaction
          .editReply({ content: commandErrorMessage(error), allowedMentions: { parse: [] } })
          .catch(() => undefined);
      else if (!interaction.replied)
        await interaction
          .reply({
            content: commandErrorMessage(error),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
          })
          .catch(() => undefined);
    }
  }

  invokeComponent(
    context: CommandContext,
    name: string,
    values: Readonly<Record<string, ArgumentValue>> = {},
    subcommand: string | null = null,
  ): Promise<void> {
    return this.track(() => this.runComponent(context, name, values, subcommand));
  }
  private async runComponent(
    context: CommandContext,
    name: string,
    values: Readonly<Record<string, ArgumentValue>>,
    subcommand: string | null,
  ): Promise<void> {
    const command = this.services.registry.get(name);
    if (!command)
      throw new CommandError('ARGUMENT', 'This controller action is no longer available.');
    const args = parseValues(command, values, subcommand);
    const next = new CommandContext(
      this.services,
      context.origin,
      context.guild,
      context.channel,
      context.user,
      context.member,
      context.settings,
      args,
      (ctx, policy) => this.guard(ctx, policy),
      context.signal,
    );
    next.expectedPlaybackId = context.expectedPlaybackId;
    await this.execute(next, command);
  }
  async componentContext(
    interaction: MessageComponentInteraction,
    location?: { guildId: string; channelId: string },
  ): Promise<CommandContext> {
    return this.context({ kind: 'component', interaction }, new Arguments(null, {}), location);
  }

  async guard(context: CommandContext, policy: CommandPolicy): Promise<void> {
    if (this.closing)
      throw new CommandError('COOLDOWN', 'The bot is restarting. Try again shortly.');
    context.member = await context.guild.members.fetch(context.user.id);
    context.settings = await this.services.repositories.guildSettings.get(context.guildId);
    if (!this.services.players.view(context.guildId))
      context.savedSnapshot =
        (
          await this.services.repositories.queueSnapshots.load(
            this.services.players.botId,
            context.guildId,
          )
        )?.snapshot ?? null;
    const owner = this.services.env.OWNER_IDS.includes(context.user.id);
    if (
      !(policy.owner && owner) &&
      (await this.services.repositories.blacklist.findMatch(context.user.id, context.guildId))
    )
      throw new CommandError(
        'BLACKLIST',
        'Music commands are disabled for your account or this server.',
      );
    const count = context.args.has('count')
      ? context.args.number('count')
      : context.args.has('position') && policy.skip
        ? context.args.number('position')
        : 1;
    authorize(policy, context.settings, context.facts(count));
    checkTextPermissions(await context.guild.members.fetch(context.botId), context.channel);
    if (
      context.expectedPlaybackId &&
      this.services.players.view(context.guildId)?.currentPlaybackId !== context.expectedPlaybackId
    )
      throw new CommandError('ARGUMENT', 'This track ended. Use the current controller.');
  }

  private async context(
    origin: CommandOrigin,
    args: Arguments,
    location?: { guildId: string; channelId: string },
  ): Promise<CommandContext> {
    const guildId =
      location?.guildId ??
      (origin.kind === 'prefix' ? origin.message.guildId : origin.interaction.guildId);
    if (!guildId) throw new CommandError('GUILD_ONLY', 'Use music commands in a server.');
    const guild = await this.services.client.guilds.fetch(guildId);
    const channelId =
      location?.channelId ??
      (origin.kind === 'prefix' ? origin.message.channelId : origin.interaction.channelId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.isSendable())
      throw new CommandError('GUILD_ONLY', 'Use a text channel or thread where I can reply.');
    const user = origin.kind === 'prefix' ? origin.message.author : origin.interaction.user;
    const member = await guild.members.fetch(user.id);
    const settings = await this.services.repositories.guildSettings.get(guildId);
    return new CommandContext(
      this.services,
      origin,
      guild,
      channel,
      user,
      member,
      settings,
      args,
      (ctx, policy) => this.guard(ctx, policy),
      this.cancellation.signal,
    );
  }
  private async execute(context: CommandContext, command: Command): Promise<void> {
    context.privateResponse = command.ephemeral;
    const policy =
      typeof command.policy === 'function' ? command.policy(context.args) : command.policy;
    await this.guard(context, policy);
    const key = `${context.botId}:${context.guildId}:${context.user.id}`;
    const running = `${key}:${command.name}`;
    if (this.inFlight.has(running))
      throw new CommandError('COOLDOWN', 'That command is already running.');
    this.cooldowns.consume(key, this.services.env.COMMAND_COOLDOWN_MS);
    this.inFlight.add(running);
    try {
      await command.execute(context);
      this.scheduleCleanup(context);
    } finally {
      this.inFlight.delete(running);
    }
  }
  private scheduleCleanup(context: CommandContext): void {
    if (!context.settings.cleanMode || context.keepResponse) return;
    for (const message of context.responses) {
      const ephemeral = message.flags.has(MessageFlags.Ephemeral);
      if (!ephemeral && message.guildId !== context.guildId) continue;
      const seconds = ephemeral
        ? Math.min(context.settings.cleanAfterSeconds, 840)
        : context.settings.cleanAfterSeconds;
      const timer = setTimeout(() => {
        this.cleanup.delete(timer);
        if (ephemeral && context.origin.kind !== 'prefix')
          void context.origin.interaction.webhook.deleteMessage(message.id).catch(() => undefined);
        else void message.delete().catch(() => undefined);
      }, seconds * 1000);
      timer.unref();
      this.cleanup.add(timer);
    }
  }
  private log(error: unknown): void {
    this.services.logger.warn({ code: commandErrorCode(error) }, 'Command failed.');
  }
  beginShutdown(): void {
    this.closing = true;
    this.cancellation.abort();
    for (const timer of this.cleanup) clearTimeout(timer);
    this.cleanup.clear();
  }
  async close(): Promise<void> {
    this.beginShutdown();
    await Promise.allSettled([...this.active]);
    this.cooldowns.clear();
    this.inFlight.clear();
  }
  private track(operation: () => Promise<void>): Promise<void> {
    if (this.closing) return Promise.resolve();
    const task = operation();
    this.active.add(task);
    void task.then(
      () => this.active.delete(task),
      () => this.active.delete(task),
    );
    return task;
  }
}

export function prefixBody(content: string, prefix: string, botId: string): string | null {
  if (content.startsWith(prefix)) return content.slice(prefix.length).trimStart();
  const mention = new RegExp(`^<@!?${botId}>(?:\\s+|(?=\\S)|$)`);
  const match = mention.exec(content);
  return match ? content.slice(match[0].length).trimStart() : null;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/framework/InteractionRouter.ts

````typescript
import { randomBytes } from 'node:crypto';
import { MessageFlags } from 'discord.js';
import type { MessageComponentInteraction } from 'discord.js';
import type { CommandContext } from './CommandContext.js';
import type { CommandHandler } from './CommandHandler.js';
import { CommandError, commandErrorCode, commandErrorMessage } from './errors.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export interface InteractionSessionOptions {
  guildId: string;
  channelId: string;
  sourceChannelId?: string;
  userId: string | null;
  lifetimeMs: number;
  policy: CommandPolicy;
  acknowledgment?: 'reply' | 'update';
  once?: boolean;
  actions: Readonly<
    Record<string, (context: CommandContext, values: readonly string[]) => Promise<void>>
  >;
  onExpire?: () => Promise<void>;
}
export interface InteractionSessionHandle {
  id(action: string): string;
  bind(messageId: string): void;
  dispose(): void;
}
interface Session {
  options: InteractionSessionOptions;
  messageId: string | null;
  expiresAt: number;
  busy: Set<string>;
  timer: ReturnType<typeof setTimeout>;
}

/** Opaque, message-bound sessions. Copying or editing custom IDs never authorizes an action. */
export class InteractionRouter {
  private readonly sessions = new Map<string, Session>();
  private readonly active = new Set<Promise<boolean>>();
  constructor(
    private readonly handler: CommandHandler,
    private readonly maximum = 2000,
  ) {}
  register(options: InteractionSessionOptions): InteractionSessionHandle {
    if (this.sessions.size >= this.maximum)
      throw new CommandError('COOLDOWN', 'Too many active menus. Try again shortly.');
    if (
      !Number.isInteger(options.lifetimeMs) ||
      options.lifetimeMs < 1000 ||
      options.lifetimeMs > 86_400_000 ||
      !Object.keys(options.actions).length ||
      Object.keys(options.actions).some((action) => !/^[a-z0-9_-]{1,24}$/.test(action))
    )
      throw new Error('Invalid interaction session.');
    const nonce = randomBytes(16).toString('base64url');
    const timer = setTimeout(() => this.remove(nonce), options.lifetimeMs);
    timer.unref();
    this.sessions.set(nonce, {
      options,
      messageId: null,
      expiresAt: Date.now() + options.lifetimeMs,
      busy: new Set(),
      timer,
    });
    return {
      id: (action) => {
        if (!Object.hasOwn(options.actions, action)) throw new Error('Unknown action.');
        return `dms:${nonce}:${action}`;
      },
      bind: (messageId) => {
        const session = this.sessions.get(nonce);
        if (session) session.messageId = messageId;
      },
      dispose: () => this.remove(nonce),
    };
  }
  owns(customId: string): boolean {
    return this.sessions.has(customId.split(':')[1] ?? '');
  }
  handle(interaction: MessageComponentInteraction): Promise<boolean> {
    const task = this.dispatch(interaction);
    this.active.add(task);
    void task.then(
      () => this.active.delete(task),
      () => this.active.delete(task),
    );
    return task;
  }
  private async dispatch(interaction: MessageComponentInteraction): Promise<boolean> {
    const match = /^dms:([A-Za-z0-9_-]{22}):([a-z0-9_-]{1,24})$/.exec(interaction.customId);
    if (!match) return false;
    const nonce = match[1] ?? '';
    const action = match[2] ?? '';
    const session = this.sessions.get(nonce);
    try {
      if (!session || session.expiresAt <= Date.now())
        throw new CommandError('ARGUMENT', 'This menu expired. Run the command again.');
      if (
        (interaction.guildId !== null && session.options.guildId !== interaction.guildId) ||
        (interaction.guildId === null && !session.options.userId) ||
        session.options.channelId !== interaction.channelId ||
        session.messageId !== interaction.message.id
      )
        throw new CommandError('PERMISSION', 'This control belongs to another message.');
      if (session.options.userId && session.options.userId !== interaction.user.id)
        throw new CommandError('PERMISSION', 'Only the person who opened this menu can use it.');
      const callback = Object.hasOwn(session.options.actions, action)
        ? session.options.actions[action]
        : undefined;
      if (!callback) throw new CommandError('ARGUMENT', 'This action is unavailable.');
      if (session.busy.has(interaction.user.id))
        throw new CommandError('COOLDOWN', 'Your previous action is still running.');
      session.busy.add(interaction.user.id);
      try {
        if (session.options.acknowledgment === 'update') await interaction.deferUpdate();
        else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const context = await this.handler.componentContext(interaction, {
          guildId: session.options.guildId,
          channelId: session.options.sourceChannelId ?? session.options.channelId,
        });
        await this.handler.guard(context, session.options.policy);
        await callback(context, interaction.isStringSelectMenu() ? interaction.values : []);
        if (session.options.once) this.remove(nonce);
      } finally {
        session.busy.delete(interaction.user.id);
      }
    } catch (error) {
      this.handler.services.logger.warn(
        { code: commandErrorCode(error) },
        'Control action failed.',
      );
      const response = {
        content: commandErrorMessage(error),
        flags: MessageFlags.Ephemeral as const,
        allowedMentions: { parse: [] as [] },
      };
      if (interaction.deferred || interaction.replied)
        await interaction.followUp(response).catch(() => undefined);
      else await interaction.reply(response).catch(() => undefined);
    }
    return true;
  }
  private remove(nonce: string): void {
    const session = this.sessions.get(nonce);
    if (!session) return;
    clearTimeout(session.timer);
    this.sessions.delete(nonce);
    if (session.options.onExpire) void session.options.onExpire().catch(() => undefined);
  }
  close(): void {
    for (const nonce of this.sessions.keys()) this.remove(nonce);
  }
  async drain(): Promise<void> {
    await Promise.allSettled([...this.active]);
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/PlayerManager.ts

````typescript
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Logger } from 'pino';
import type { Env } from '../../config/env.js';
import type { Repositories } from '../db/contracts.js';
import { queueSnapshotSchema, requesterSchema } from '../db/models.js';
import type {
  AudioFilters,
  GuildSettings,
  HistoryEndReason,
  LoopMode,
  PendingImport,
  QueueEntry,
  QueueSnapshot,
  Requester,
  SnapshotRecord,
  StoredTrack,
} from '../db/models.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError, errorCode } from '../utils/errors.js';
import { QueueManager, createQueueEntry } from './QueueManager.js';
import type { SourceResolver } from './SourceResolver.js';
import type { AutoplayEngine } from './AutoplayEngine.js';
import { ImportScheduler } from './ImportScheduler.js';
import { validateFilters } from './FilterPresets.js';
import { catalogSources } from './TrackCodec.js';
import type { AudioTransport, ResolvedItem, TrackEvent } from './types.js';

interface EngineEvents {
  changed: [snapshot: QueueSnapshot];
  trackStart: [snapshot: QueueSnapshot];
  trackEnd: [snapshot: QueueSnapshot, reason: HistoryEndReason];
  queueEnd: [snapshot: QueueSnapshot];
  notice: [guildId: string, message: string];
  importProgress: [guildId: string, importId: string, enqueued: number, total: number | null];
  destroyed: [guildId: string];
}
interface Session {
  state: QueueSnapshot;
  queue: QueueManager;
  settings: GuildSettings;
  version: SnapshotRecord | null;
  lock: AsyncLock;
  closed: boolean;
  online: boolean;
  playing: boolean;
  positionAt: number;
  pump: Promise<void> | null;
  wake: boolean;
  resolution: AbortController | null;
  prefetching: Set<string>;
  prefetchFailed: Set<string>;
  workAbort: AbortController;
  excluded: Set<string>;
  retries: number;
  emptyVoice: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}
export interface ImportResult {
  id: string;
  name: string;
  enqueued: number;
  total: number | null;
  background: boolean;
  tracks: StoredTrack[];
}
interface ImportWaiter {
  first: Promise<ImportResult>;
  resolve: (result: ImportResult) => void;
  reject: (error: MusicError) => void;
  name: string;
  count: number;
  total: number | null;
  settled: boolean;
  replaceCurrent: boolean;
  tracks: StoredTrack[];
}

/** Every session is scoped to this bot account + guild; all mutations/checkpoints are serialized. */
export class PlayerManager extends EventEmitter<EngineEvents> {
  private readonly sessions = new Map<string, Session>();
  private readonly joins = new Map<string, AsyncLock>();
  private readonly waiters = new Map<string, ImportWaiter>();
  private readonly imports: ImportScheduler;
  private readonly background = new Set<Promise<void>>();
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;
  private closing = false;
  constructor(
    public readonly botId: string,
    private readonly env: Pick<
      Env,
      'MAX_PLAYLIST_IMPORT' | 'IMPORT_CONCURRENCY' | 'SPONSORBLOCK_ENABLED'
    >,
    private readonly repositories: Repositories,
    public readonly transport: AudioTransport,
    public readonly resolver: SourceResolver,
    private readonly autoplay: AutoplayEngine,
    private readonly logger: Logger,
  ) {
    super();
    this.imports = new ImportScheduler(resolver, env.IMPORT_CONCURRENCY);
  }

  get size(): number {
    return [...this.sessions.values()].filter((session) => !session.closed).length;
  }
  guildIds(): string[] {
    return [...this.sessions.keys()];
  }
  offlineNodeIds(): string[] {
    return [
      ...new Set(
        [...this.sessions.values()]
          .filter((session) => !session.closed && !session.online)
          .map((session) => session.state.nodeId)
          .filter((id): id is string => id !== null),
      ),
    ];
  }
  view(guildId: string): QueueSnapshot | null {
    const session = this.sessions.get(guildId);
    return session && !session.closed ? this.snapshot(session) : null;
  }
  startCheckpoints(): void {
    if (this.checkpointTimer) return;
    this.checkpointTimer = setInterval(() => this.watch(this.checkpointAll()), 10_000);
    this.checkpointTimer.unref();
  }

  async join(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<QueueSnapshot> {
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    let lock = this.joins.get(guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.joins.set(guildId, lock);
    }
    return lock.run(async () => {
      const existing = this.sessions.get(guildId);
      if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
      if (existing) {
        if (existing.closed)
          throw new MusicError(
            'CONFLICT',
            'Another process changed this player. Restart this bot process before recovering it.',
          );
        if (existing.state.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'The bot is already playing in another voice channel. Use move to bring it here.',
          );
        return this.snapshot(existing);
      }
      const settings = await this.repositories.guildSettings.get(guildId);
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) {
        if (record.snapshot.voiceChannelId !== voiceChannelId)
          throw new MusicError(
            'CONFLICT',
            'A saved player belongs to another voice channel. Restore or disconnect it first.',
          );
        return this.restoreLocked(record);
      }
      const state = queueSnapshotSchema.parse({
        version: 1,
        botId: this.botId,
        guildId,
        voiceChannelId,
        textChannelId,
        nodeId: null,
        nodeSessionId: null,
        current: null,
        currentPlaybackId: null,
        upcoming: [],
        previous: [],
        positionMs: 0,
        paused: false,
        volume: settings.defaultVolume,
        loopMode: 'off',
        autoplay: settings.autoplayEnabled,
        filters: {},
        pendingImports: [],
      });
      const session = this.createSession(state, settings, null);
      try {
        const node = await this.transport.connect(state);
        if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        await this.persist(session);
        this.sessions.set(guildId, session);
        await this.configureSponsor(session);
        this.scheduleIdle(session);
        return this.snapshot(session);
      } catch (error) {
        session.closed = true;
        await this.transport.destroy(guildId).catch(() => undefined);
        throw error;
      }
    });
  }

  async restore(record: SnapshotRecord): Promise<QueueSnapshot> {
    let lock = this.joins.get(record.guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.joins.set(record.guildId, lock);
    }
    return lock.run(() => this.restoreLocked(record));
  }
  private async restoreLocked(record: SnapshotRecord): Promise<QueueSnapshot> {
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    const existing = this.sessions.get(record.guildId);
    if (existing) {
      if (existing.closed)
        throw new MusicError('CONFLICT', 'Another process owns a newer player snapshot.');
      return this.snapshot(existing);
    }
    if (record.botId !== this.botId)
      throw new MusicError('CONFLICT', 'The saved queue belongs to another bot.');
    const settings = await this.repositories.guildSettings.get(record.guildId);
    const state = structuredClone(record.snapshot);
    // Re-resolve saved encodings, especially HTTP sources. The cached file UUID remains authoritative.
    if (state.current) state.current.playable = null;
    for (const entry of state.upcoming) entry.playable = null;
    const session = this.createSession(state, settings, record);
    const node = await this.transport.connect(state);
    if (this.closing) throw new MusicError('UNAVAILABLE', 'The bot is restarting.');
    session.state.nodeId = node.nodeId;
    session.state.nodeSessionId = node.sessionId;
    await this.persist(session);
    this.sessions.set(record.guildId, session);
    await this.configureSponsor(session);
    for (const job of state.pendingImports) this.startImport(session, job);
    this.kick(session);
    this.prefetch(session);
    return this.snapshot(session);
  }

  async enqueue(
    guildId: string,
    items: readonly ResolvedItem[],
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<number> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    await this.locked(session, async () => {
      const entries = items.map((item) => {
        this.validateLength(session, item.track.durationMs, item.track.isStream);
        return createQueueEntry(item.track, requester, item.playable);
      });
      this.assertCapacity(
        session,
        entries.length - Number(mode === 'now' && Boolean(session.state.current)),
      );
      if (mode === 'now' && entries.length) await this.retire(session, 'replaced');
      session.queue.add(entries, mode === 'append' ? session.queue.size + 1 : 1);
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
    this.prefetch(session);
    return items.length;
  }

  async enqueueQuery(
    guildId: string,
    query: string,
    requester: Requester,
    mode: 'append' | 'next' | 'now' = 'append',
  ): Promise<ImportResult> {
    const session = this.require(guildId);
    requesterSchema.parse(requester);
    // Validate without contacting providers; the scheduler also validates before loading.
    if (!query.trim() || query.length > 4096)
      throw new MusicError('INVALID_INPUT', 'Provide a music title or link.');
    const job = await this.locked(session, async () => {
      if (session.state.pendingImports.length >= 10)
        throw new MusicError('QUEUE_FULL', 'Wait for an existing playlist import to finish.');
      const available =
        session.settings.maxQueueSize -
        session.queue.size -
        Number(mode !== 'now' && Boolean(session.state.current));
      if (available < 1) throw new MusicError('QUEUE_FULL', 'The queue is full.');
      const pending: PendingImport = {
        id: randomUUID(),
        query: query.trim(),
        requester: structuredClone(requester),
        mode: mode === 'append' ? 'append' : 'next',
        processedCount: 0,
        limit: Math.min(this.env.MAX_PLAYLIST_IMPORT, available),
        enqueuedKeys: [],
        createdAt: Date.now(),
      };
      session.state.pendingImports.push(pending);
      await this.persist(session);
      return pending;
    });
    const waiter = this.makeWaiter(mode === 'now');
    this.waiters.set(job.id, waiter);
    this.startImport(session, job);
    return waiter.first;
  }

  async mutateQueue<T>(
    guildId: string,
    operation: (queue: QueueManager) => T,
    expectedPlaybackId?: string,
  ): Promise<T> {
    const session = this.require(guildId);
    const value = await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      const before = session.queue.view();
      try {
        const result = operation(session.queue);
        await this.persist(session);
        this.changed(session);
        return result;
      } catch (error) {
        session.queue = new QueueManager(
          before,
          Math.max(session.settings.maxQueueSize, before.length),
        );
        session.queue.setMaximum(session.settings.maxQueueSize);
        throw error;
      }
    });
    this.kick(session);
    this.prefetch(session);
    return value;
  }

  async pause(guildId: string, paused: boolean, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      this.requireCurrent(session);
      this.capturePosition(session);
      await this.transport.pause(guildId, paused);
      session.state.paused = paused;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => this.seekLocked(session, positionMs));
  }
  async seekRelative(guildId: string, offsetMs: number): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, () => {
      const current = this.requireCurrent(session);
      return this.seekLocked(
        session,
        Math.max(
          0,
          Math.min(
            this.position(session) + offsetMs,
            (current.playable?.durationMs ?? current.track.durationMs) - 1,
          ),
        ),
      );
    });
  }

  async skip(guildId: string, count = 1, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      if (expectedPlaybackId && session.state.currentPlaybackId !== expectedPlaybackId)
        throw new MusicError('CONFLICT', 'The current track changed. Try the command again.');
      this.requireCurrent(session);
      if (!Number.isInteger(count) || count < 1 || count > session.queue.size + 1)
        throw new MusicError('INVALID_INPUT', 'That skip count exceeds the queue.');
      await this.retire(session, 'skipped');
      for (let index = 1; index < count; index++) session.queue.take();
      await this.persist(session);
      this.changed(session);
    });
    this.kick(session);
  }
  async skipTo(guildId: string, position: number): Promise<void> {
    const session = this.require(guildId);
    if (!Number.isInteger(position) || position < 1 || position > session.queue.size)
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
    if (session.state.current) await this.skip(guildId, position);
    else {
      await this.mutateQueue(guildId, (queue) => {
        for (let index = 1; index < position; index++) queue.take();
      });
    }
  }
  async replay(guildId: string): Promise<void> {
    const session = this.require(guildId);
    session.resolution?.abort();
    await this.locked(session, async () => {
      const current = structuredClone(this.requireCurrent(session));
      await this.retire(session, 'replaced');
      session.state.current = current;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }
  async previous(guildId: string, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      const previous = session.state.previous[0];
      if (!previous) throw new MusicError('NOT_FOUND', 'There is no previous track.');
      this.assertCapacity(session, 1);
      session.state.previous.shift();
      const current = session.state.current ? structuredClone(session.state.current) : null;
      if (current) {
        await this.retire(session, 'replaced', false);
        current.id = randomUUID();
        session.queue.add([current], 1, false);
      }
      previous.id = randomUUID();
      session.state.current = previous;
      session.state.currentPlaybackId = randomUUID();
      session.state.positionMs = 0;
      session.state.paused = false;
      await this.persist(session);
    });
    this.kick(session);
  }

  async stop(guildId: string, expectedPlaybackId?: string): Promise<void> {
    const session = this.require(guildId);
    if (!expectedPlaybackId) session.resolution?.abort();
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      this.cancelImports(session);
      await this.retire(session, 'stopped');
      session.prefetchFailed.clear();
      session.queue.clear(false);
      session.state.loopMode = 'off';
      session.state.autoplay = false;
      await this.persist(session);
      this.changed(session);
      this.scheduleIdle(session);
    });
  }
  async clearQueue(guildId: string): Promise<number> {
    const session = this.require(guildId);
    return this.locked(session, async () => {
      this.cancelImports(session);
      const count = session.queue.clear();
      session.prefetchFailed.clear();
      await this.persist(session);
      this.changed(session);
      return count;
    });
  }
  async leave(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      const record = await this.repositories.queueSnapshots.load(this.botId, guildId);
      if (record) await this.repositories.queueSnapshots.delete(this.botId, guildId, record);
      await this.transport.destroy(guildId);
      return;
    }
    session.resolution?.abort();
    await this.locked(session, async () => {
      session.closed = true;
      session.workAbort.abort();
      this.cancelIdle(session);
      this.cancelImports(session);
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'stopped');
      await this.transport
        .destroy(guildId)
        .catch(() => this.logger.warn({ guildId }, 'Audio disconnect failed.'));
      if (session.version)
        await this.repositories.queueSnapshots.delete(this.botId, guildId, session.version);
      this.sessions.delete(guildId);
      this.joins.delete(guildId);
      this.emit('destroyed', guildId);
    });
  }
  async moveVoice(
    guildId: string,
    voiceChannelId: string,
    textChannelId: string | null,
  ): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      const candidate = this.snapshot(session);
      candidate.voiceChannelId = voiceChannelId;
      candidate.textChannelId = textChannelId;
      const node = await this.transport.connect(candidate);
      session.state.voiceChannelId = voiceChannelId;
      session.state.textChannelId = textChannelId;
      session.state.nodeId = node.nodeId;
      session.state.nodeSessionId = node.sessionId;
      session.emptyVoice = false;
      this.cancelIdle(session);
      await this.persist(session);
      this.changed(session);
    });
  }

  async volume(guildId: string, volume: number, expectedPlaybackId?: string): Promise<void> {
    if (!Number.isInteger(volume) || volume < 1 || volume > 200)
      throw new MusicError('INVALID_INPUT', 'Volume must be between 1 and 200.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      await this.transport.volume(guildId, volume);
      session.settings = await this.repositories.guildSettings.update(guildId, {
        defaultVolume: volume,
      });
      session.state.volume = volume;
      await this.persist(session);
      this.changed(session);
    });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    const parsed = validateFilters(filters);
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.capturePosition(session);
      await this.transport.filters(guildId, parsed);
      session.state.filters = parsed;
      session.positionAt = Date.now();
      await this.persist(session);
      this.changed(session);
    });
  }
  async loop(guildId: string, mode: LoopMode, expectedPlaybackId?: string): Promise<void> {
    if (!['off', 'track', 'queue'].includes(mode))
      throw new MusicError('INVALID_INPUT', 'Loop mode must be off, track, or queue.');
    const session = this.require(guildId);
    await this.locked(session, async () => {
      this.assertPlayback(session, expectedPlaybackId);
      session.state.loopMode = mode;
      await this.persist(session);
      this.changed(session);
    });
  }
  async setAutoplay(guildId: string, enabled: boolean): Promise<void> {
    const session = this.require(guildId);
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.update(guildId, {
        autoplayEnabled: enabled,
      });
      session.state.autoplay = enabled;
      await this.persist(session);
      this.changed(session);
    });
    if (enabled) this.kick(session);
  }
  async refreshSettings(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) return;
    await this.locked(session, async () => {
      session.settings = await this.repositories.guildSettings.get(guildId);
      session.queue.setMaximum(session.settings.maxQueueSize);
      await this.configureSponsor(session);
      this.scheduleIdle(session);
    });
  }
  setVoiceOccupancy(guildId: string, humans: number): void {
    const session = this.sessions.get(guildId);
    if (!session) return;
    session.emptyVoice = humans === 0;
    this.scheduleIdle(session);
  }

  /** Called by Phase 6 event adapters, with IDs from Lavalink's original event payload. */
  async onTrackEvent(event: TrackEvent): Promise<void> {
    const session = this.sessions.get(event.guildId);
    if (!session || session.closed) return;
    await this.locked(session, async () => {
      if (
        !session.state.current ||
        !event.playbackId ||
        event.playbackId !== session.state.currentPlaybackId
      )
        return;
      if (event.type === 'start') {
        this.emit('trackStart', this.snapshot(session));
        return;
      }
      if (event.type === 'end' && ['replaced', 'stopped', 'cleanup'].includes(event.reason ?? ''))
        return;
      if (event.type === 'error' || event.type === 'stuck' || event.reason === 'loadFailed') {
        await this.retryOrAdvance(session, event.encoded);
        return;
      }
      if (event.type !== 'end' || event.reason !== 'finished') return;
      const finished = structuredClone(session.state.current);
      await this.retire(session, 'finished', true, false);
      if (session.state.loopMode === 'track') {
        finished.id = randomUUID();
        session.state.current = finished;
        session.state.currentPlaybackId = randomUUID();
      } else if (session.state.loopMode === 'queue') {
        finished.id = randomUUID();
        if (session.queue.size < session.settings.maxQueueSize)
          session.queue.add([finished], session.queue.size + 1, false);
        else
          this.emit(
            'notice',
            session.state.guildId,
            'The lowered queue limit prevented re-adding the looped track.',
          );
      }
      await this.persist(session);
    });
    this.kick(session);
    this.prefetch(session);
  }

  /** Freeze the clock; keep the current track and queue intact while nodes reconnect. */
  async nodeDisconnected(nodeId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId) continue;
      session.resolution?.abort();
      await this.locked(session, async () => {
        this.capturePosition(session);
        session.online = false;
        session.playing = false;
        await this.persist(session);
        const replacement = await this.transport
          .migrate(session.state.guildId, nodeId)
          .catch(() => null);
        if (replacement) {
          session.state.nodeId = replacement.nodeId;
          session.state.nodeSessionId = replacement.sessionId;
          session.online = true;
          session.prefetchFailed.clear();
          if (session.state.current) session.state.current.playable = null;
          await this.persist(session);
        }
      });
      if (session.online) this.kick(session);
    }
  }
  async nodeConnected(nodeId: string, offlineOnly = false): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.closed || session.state.nodeId !== nodeId || (offlineOnly && session.online))
        continue;
      await this.locked(session, async () => {
        const node = await this.transport.connect(this.snapshot(session));
        session.state.nodeId = node.nodeId;
        session.state.nodeSessionId = node.sessionId;
        session.online = true;
        session.prefetchFailed.clear();
        session.playing = false;
        if (session.state.current) session.state.current.playable = null;
        await this.persist(session);
        await this.configureSponsor(session);
      });
      this.kick(session);
      this.prefetch(session);
    }
  }
  async updatePosition(guildId: string, positionMs: number): Promise<void> {
    const session = this.sessions.get(guildId);
    if (
      !session ||
      !session.state.current ||
      !session.online ||
      !session.playing ||
      !Number.isFinite(positionMs) ||
      positionMs < 0
    )
      return;
    await this.locked(session, () => {
      session.state.positionMs = Math.round(positionMs);
      session.positionAt = Date.now();
      return Promise.resolve();
    });
  }

  async checkpointAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (!session.closed)
        await this.locked(session, async () => {
          this.capturePosition(session);
          await this.persist(session);
        });
    }
  }
  /** Save resumable state and cancel work; do not delete queues or destroy Lavalink sessions. */
  async close(): Promise<void> {
    this.closing = true;
    const resumable = [...this.sessions.values()].filter((session) => !session.closed);
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.checkpointTimer = null;
    for (const session of this.sessions.values()) {
      session.closed = true;
      session.workAbort.abort();
      session.resolution?.abort();
      this.cancelIdle(session);
    }
    await this.imports.close();
    for (const waiter of this.waiters.values())
      if (!waiter.settled) {
        waiter.reject(
          new MusicError('UNAVAILABLE', 'The import will resume after the bot restarts.'),
        );
        waiter.settled = true;
      }
    await Promise.allSettled([...this.background]);
    for (const session of resumable)
      await session.lock.run(async () => {
        this.capturePosition(session);
        await this.persist(session);
      });
  }

  private createSession(
    state: QueueSnapshot,
    settings: GuildSettings,
    version: SnapshotRecord | null,
  ): Session {
    const queue = new QueueManager(
      state.upcoming,
      Math.max(settings.maxQueueSize, state.upcoming.length),
    );
    queue.setMaximum(settings.maxQueueSize);
    return {
      state,
      queue,
      settings,
      version,
      lock: new AsyncLock(),
      closed: false,
      online: true,
      playing: false,
      positionAt: Date.now(),
      pump: null,
      wake: false,
      resolution: null,
      prefetching: new Set(),
      prefetchFailed: new Set(),
      workAbort: new AbortController(),
      excluded: new Set(),
      retries: 0,
      emptyVoice: false,
      idleTimer: null,
    };
  }
  private snapshot(session: Session): QueueSnapshot {
    return {
      ...structuredClone(session.state),
      upcoming: session.queue.view(),
      positionMs: this.position(session),
    };
  }
  private position(session: Session): number {
    const elapsed =
      session.playing && session.online && !session.state.paused
        ? Date.now() - session.positionAt
        : 0;
    const scale = session.state.filters.timescale;
    const position = session.state.positionMs + elapsed * (scale?.speed ?? 1) * (scale?.rate ?? 1);
    const length =
      session.state.current?.playable?.durationMs ?? session.state.current?.track.durationMs ?? 0;
    return Math.round(
      Math.max(0, session.state.current?.track.isStream ? position : Math.min(position, length)),
    );
  }
  private capturePosition(session: Session): void {
    session.state.positionMs = this.position(session);
    session.positionAt = Date.now();
  }
  private async persist(session: Session): Promise<void> {
    const snapshot = this.snapshot(session);
    try {
      session.version = await this.repositories.queueSnapshots.save(snapshot, session.version);
    } catch (error) {
      // A different process owns a newer generation/revision. Stop this session from overwriting it.
      if (error instanceof Error && 'code' in error && error.code === 'STALE_SNAPSHOT') {
        session.closed = true;
        session.workAbort.abort();
        session.resolution?.abort();
        this.cancelIdle(session);
        this.logger.error({ guildId: snapshot.guildId }, 'Snapshot conflict; player suspended.');
      }
      throw error;
    }
  }
  private changed(session: Session): void {
    this.cancelIdle(session);
    this.emit('changed', this.snapshot(session));
    this.scheduleIdle(session);
  }
  private require(guildId: string): Session {
    const session = this.sessions.get(guildId);
    if (!session || session.closed)
      throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    return session;
  }
  private locked<T>(session: Session, operation: () => Promise<T>): Promise<T> {
    return session.lock.run(() => {
      if (session.closed) throw new MusicError('NO_PLAYER', 'This player has disconnected.');
      return operation();
    });
  }
  private requireCurrent(session: Session): QueueEntry {
    if (!session.state.current) throw new MusicError('NO_PLAYER', 'Nothing is playing.');
    return session.state.current;
  }
  private async seekLocked(session: Session, positionMs: number): Promise<void> {
    const current = this.requireCurrent(session);
    if (!current.playable?.isSeekable || current.playable.isStream)
      throw new MusicError('NOT_SEEKABLE', 'Live streams and this audio source cannot be seeked.');
    if (
      !Number.isInteger(positionMs) ||
      positionMs < 0 ||
      positionMs >= current.playable.durationMs
    )
      throw new MusicError('INVALID_INPUT', 'Choose a position within the current track.');
    await this.transport.seek(session.state.guildId, positionMs);
    session.state.positionMs = positionMs;
    session.positionAt = Date.now();
    await this.persist(session);
    this.changed(session);
  }
  private assertCapacity(session: Session, added: number): void {
    if (
      session.queue.size + Number(Boolean(session.state.current)) + added >
      session.settings.maxQueueSize
    )
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private validateLength(session: Session, durationMs: number, isStream: boolean): void {
    if (
      !isStream &&
      (durationMs <= 0 || durationMs > session.settings.maxTrackLengthSeconds * 1000)
    )
      throw new MusicError(
        'INVALID_INPUT',
        'This track exceeds the server duration limit or has no known duration.',
      );
  }

  private kick(session: Session): void {
    if (session.closed || !session.online) return;
    if (session.pump) {
      session.wake = true;
      return;
    }
    const task = this.pump(session)
      .catch((error: unknown) => {
        this.logger.warn(
          { guildId: session.state.guildId, code: errorCode(error) },
          'Playback operation failed.',
        );
        this.emit(
          'notice',
          session.state.guildId,
          'Playback is temporarily unavailable. Your queue has been saved.',
        );
      })
      .finally(() => {
        session.pump = null;
        if (session.wake) {
          session.wake = false;
          this.kick(session);
        }
      });
    session.pump = task;
    this.watch(task);
  }
  private async pump(session: Session): Promise<void> {
    while (!session.closed && session.online) {
      const claim = await this.locked(session, async () => {
        if (session.closed || session.playing) return null;
        if (!session.state.current) {
          session.state.current = session.queue.take();
          if (session.state.current) session.prefetchFailed.delete(session.state.current.id);
          session.state.currentPlaybackId = session.state.current ? randomUUID() : null;
          session.state.positionMs = 0;
          session.state.paused = false;
        }
        if (!session.state.current) return null;
        session.state.currentPlaybackId ??= randomUUID();
        const controller = new AbortController();
        session.resolution = controller;
        await this.persist(session);
        return {
          entry: structuredClone(session.state.current),
          id: session.state.currentPlaybackId,
          nodeId: session.state.nodeId,
          controller,
        };
      });
      if (!claim) {
        if (!session.state.current && !session.closed) await this.queueEnded(session);
        return;
      }
      try {
        this.validateLength(session, claim.entry.track.durationMs, claim.entry.track.isStream);
        let playable = claim.entry.playable;
        if (
          !playable ||
          session.excluded.has(playable.encoded) ||
          (catalogSources.has(claim.entry.track.source) &&
            !this.resolver.validMirror(claim.entry.track, playable))
        ) {
          playable = await this.resolver.resolve(
            claim.entry.track,
            session.excluded,
            claim.nodeId,
            claim.controller.signal,
          );
        }
        this.validateLength(session, playable.durationMs, playable.isStream);
        claim.controller.signal.throwIfAborted();
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.online ||
            session.state.currentPlaybackId !== claim.id ||
            claim.controller.signal.aborted
          )
            return;
          const current = this.requireCurrent(session);
          current.playable = playable;
          await this.persist(session);
          await this.transport.play(session.state.guildId, playable, {
            playbackId: claim.id,
            positionMs:
              playable.isSeekable && !playable.isStream
                ? Math.min(session.state.positionMs, Math.max(0, playable.durationMs - 1))
                : 0,
            paused: session.state.paused,
            volume: session.state.volume,
            filters: session.state.filters,
          });
          session.playing = true;
          session.positionAt = Date.now();
          session.resolution = null;
          await this.repositories.history.record({
            id: claim.id,
            botId: this.botId,
            guildId: session.state.guildId,
            userId: current.requester.userId,
            track: current.track,
            startedAt: Date.now(),
          });
          this.changed(session);
        });
        this.prefetch(session);
        if (session.playing) return;
      } catch (error) {
        if (claim.controller.signal.aborted) continue;
        if (!(error instanceof MusicError)) throw error;
        await this.locked(session, async () => {
          if (session.closed || session.state.currentPlaybackId !== claim.id) return;
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') {
            this.capturePosition(session);
            session.online = false;
            session.playing = false;
          } else {
            await this.retire(session, 'error');
            this.emit(
              'notice',
              session.state.guildId,
              'A full playable version was unavailable, so I skipped that track.',
            );
          }
          await this.persist(session);
        });
      }
    }
  }
  private async retire(
    session: Session,
    reason: HistoryEndReason,
    remember = true,
    stopAudio = true,
  ): Promise<void> {
    session.resolution?.abort();
    session.resolution = null;
    const current = session.state.current;
    const playbackId = session.state.currentPlaybackId;
    const ended = this.snapshot(session);
    session.playing = false;
    session.state.current = null;
    session.state.currentPlaybackId = null;
    session.state.positionMs = 0;
    session.state.paused = false;
    session.excluded.clear();
    session.retries = 0;
    session.queue.invalidateUndo();
    if (current && remember)
      session.state.previous = [structuredClone(current), ...session.state.previous].slice(0, 50);
    if (playbackId) await this.repositories.history.finish(playbackId, reason);
    if (stopAudio) await this.transport.stop(session.state.guildId).catch(() => undefined);
    if (current) this.emit('trackEnd', ended, reason);
  }
  private async retryOrAdvance(session: Session, encoded: string | null): Promise<void> {
    const current = this.requireCurrent(session);
    if (encoded) session.excluded.add(encoded);
    if (catalogSources.has(current.track.source) && session.retries < 2) {
      if (session.state.currentPlaybackId)
        await this.repositories.history.finish(session.state.currentPlaybackId, 'error');
      session.resolution?.abort();
      session.playing = false;
      session.retries++;
      current.playable = null;
      session.state.positionMs = 0;
      session.positionAt = Date.now();
      session.state.currentPlaybackId = randomUUID();
      await this.transport.stop(session.state.guildId).catch(() => undefined);
      this.emit(
        'notice',
        session.state.guildId,
        'The audio source failed. Trying another full-length mirror.',
      );
    } else {
      await this.retire(session, 'error');
      this.emit('notice', session.state.guildId, 'This track could not play, so I skipped it.');
    }
    await this.persist(session);
  }
  private async queueEnded(session: Session): Promise<void> {
    if (session.state.pendingImports.length) return; // The next page can still arrive.
    const last = session.state.previous[0];
    if (session.state.autoplay && last && !session.closed) {
      const generation = session.version?.generation;
      const entry = await this.autoplay
        .next(
          this.botId,
          session.state.guildId,
          last,
          session.queue.view(),
          session.settings.maxTrackLengthSeconds * 1000,
          session.state.nodeId,
          session.workAbort.signal,
        )
        .catch(() => null);
      if (entry) {
        await this.locked(session, async () => {
          if (
            session.closed ||
            !session.state.autoplay ||
            session.state.current ||
            session.queue.size ||
            session.version?.generation !== generation
          )
            return;
          this.assertCapacity(session, 1);
          session.queue.add([entry], 1, false);
          await this.persist(session);
          session.wake = true;
        });
        if (session.queue.size) return;
      }
    }
    this.emit('queueEnd', this.snapshot(session));
    this.scheduleIdle(session);
  }

  private startImport(session: Session, job: PendingImport): void {
    this.imports.start(
      structuredClone(job),
      {
        append: (id, items, processed, name, total) =>
          this.locked(session, async () => {
            if (session.closed) return false;
            const active = session.state.pendingImports.find((pending) => pending.id === id);
            if (!active) return false;
            const waiter = this.waiters.get(id);
            if (waiter) {
              waiter.name = name;
              waiter.total = total;
            }
            active.processedCount = processed;
            const valid = items.filter(
              (item) =>
                item.track.isStream ||
                (item.track.durationMs > 0 &&
                  item.track.durationMs <= session.settings.maxTrackLengthSeconds * 1000),
            );
            if (waiter?.replaceCurrent && valid.length) {
              waiter.replaceCurrent = false;
              await this.retire(session, 'replaced');
            }
            const available = Math.max(
              0,
              session.settings.maxQueueSize -
                session.queue.size -
                Number(Boolean(session.state.current)),
            );
            const accepted = valid.slice(0, available);
            let position = session.queue.size + 1;
            if (active.mode === 'next') {
              const lastKey = active.enqueuedKeys.at(-1);
              const entries = session.queue.view();
              const reverseIndex = [...entries]
                .reverse()
                .findIndex((entry) => entry.track.key === lastKey);
              const index = reverseIndex < 0 ? -1 : entries.length - reverseIndex - 1;
              position = index >= 0 ? index + 2 : 1;
            }
            if (accepted.length)
              session.queue.add(
                accepted.map((item) =>
                  createQueueEntry(item.track, active.requester, item.playable),
                ),
                position,
                false,
              );
            active.enqueuedKeys.push(...accepted.map((item) => item.track.key));
            if (waiter) {
              waiter.count += accepted.length;
              waiter.tracks.push(
                ...accepted
                  .slice(0, Math.max(0, 5 - waiter.tracks.length))
                  .map((item) => structuredClone(item.track)),
              );
            }
            await this.persist(session);
            if (waiter && waiter.count >= 5 && !waiter.settled) this.settleImport(id, waiter, true);
            this.emit(
              'importProgress',
              session.state.guildId,
              id,
              active.enqueuedKeys.length,
              total,
            );
            this.changed(session);
            this.kick(session);
            this.prefetch(session);
            return accepted.length === valid.length;
          }),
        complete: (id, failed, failure) =>
          this.locked(session, async () => {
            if (session.closed) return;
            session.state.pendingImports = session.state.pendingImports.filter(
              (pending) => pending.id !== id,
            );
            await this.persist(session);
            const waiter = this.waiters.get(id);
            if (waiter && !waiter.settled) {
              if (waiter.count === 0) {
                waiter.settled = true;
                waiter.reject(
                  failure ??
                    new MusicError(
                      failed ? 'UNAVAILABLE' : 'NOT_FOUND',
                      'No playable tracks could be imported.',
                    ),
                );
              } else this.settleImport(id, waiter, false);
            }
            this.waiters.delete(id);
            this.changed(session);
            this.kick(session);
          }),
      },
      (failure) => {
        const waiter = this.waiters.get(job.id);
        // A failed first page is reported by the command; avoid a second generic channel notice.
        if (waiter && !waiter.settled && waiter.count === 0) return;
        this.emit(
          'notice',
          session.state.guildId,
          `${failure?.message ?? 'The playlist import stopped because its metadata source is unavailable.'} Tracks already queued are preserved.`,
        );
      },
    );
  }
  private makeWaiter(replaceCurrent: boolean): ImportWaiter {
    let resolve!: ImportWaiter['resolve'];
    let reject!: ImportWaiter['reject'];
    const first = new Promise<ImportResult>((ready, fail) => {
      resolve = ready;
      reject = fail;
    });
    return {
      first,
      resolve,
      reject,
      name: 'Playlist',
      count: 0,
      total: null,
      settled: false,
      replaceCurrent,
      tracks: [],
    };
  }
  private settleImport(id: string, waiter: ImportWaiter, background: boolean): void {
    waiter.settled = true;
    waiter.resolve({
      id,
      name: waiter.name,
      enqueued: waiter.count,
      total: waiter.total,
      background,
      tracks: structuredClone(waiter.tracks),
    });
  }
  private cancelImports(session: Session): void {
    for (const job of session.state.pendingImports) {
      this.imports.cancel(job.id);
      const waiter = this.waiters.get(job.id);
      if (waiter && !waiter.settled) {
        waiter.settled = true;
        waiter.reject(new MusicError('UNAVAILABLE', 'The playlist import was cancelled.'));
      }
      this.waiters.delete(job.id);
    }
    session.state.pendingImports = [];
  }
  private prefetch(session: Session): void {
    if (session.closed || !session.online || !session.playing) return;
    const capacity = Math.max(0, this.env.IMPORT_CONCURRENCY - session.prefetching.size);
    if (!capacity) return;
    const excluded = new Set([...session.prefetching, ...session.prefetchFailed]);
    const entries = session.queue.unresolved(capacity, excluded);
    for (const entry of entries) {
      session.prefetching.add(entry.id);
      const task = this.resolver
        .resolve(entry.track, new Set(), session.state.nodeId, session.workAbort.signal)
        .then(async (playable) => {
          await this.locked(session, () => {
            if (session.closed || !session.queue.updatePlayable(entry.id, playable))
              return Promise.resolve();
            // Encodings are an expendable cache. Periodic checkpoints capture them in a batch;
            // a restart safely re-resolves them rather than losing catalog entries.
            return Promise.resolve();
          });
        })
        .catch(() => {
          session.prefetchFailed.add(entry.id);
        })
        .finally(() => {
          session.prefetching.delete(entry.id);
          // Failed entries wait for their turn; other songs still resolve in the background.
          this.prefetch(session);
        });
      this.watch(task);
    }
  }
  private scheduleIdle(session: Session): void {
    if (
      session.closed ||
      session.settings.stayInVoice ||
      (!session.emptyVoice &&
        (session.state.current || session.queue.size || session.state.pendingImports.length))
    ) {
      this.cancelIdle(session);
      return;
    }
    if (session.idleTimer) return;
    session.idleTimer = setTimeout(() => {
      session.idleTimer = null;
      if (
        !session.closed &&
        !session.settings.stayInVoice &&
        (session.emptyVoice ||
          (!session.state.current && !session.queue.size && !session.state.pendingImports.length))
      )
        this.watch(this.leave(session.state.guildId));
    }, session.settings.autoLeaveTimeoutSeconds * 1000);
    session.idleTimer.unref();
  }
  private cancelIdle(session: Session): void {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  private async configureSponsor(session: Session): Promise<void> {
    if (!this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled) return;
    await this.transport
      .sponsorBlock(
        session.state.guildId,
        this.env.SPONSORBLOCK_ENABLED && session.settings.sponsorBlockEnabled,
      )
      .catch(() =>
        this.emit(
          'notice',
          session.state.guildId,
          'SponsorBlock is unavailable on this audio server.',
        ),
      );
  }
  private assertPlayback(session: Session, expectedPlaybackId?: string): void {
    if (expectedPlaybackId && session.state.currentPlaybackId !== expectedPlaybackId)
      throw new MusicError('CONFLICT', 'This track ended. Use the current controller.');
  }
  private watch(task: Promise<void>): void {
    const guarded = task.catch((error: unknown) =>
      this.logger.warn({ code: errorCode(error) }, 'Background music operation failed.'),
    );
    this.background.add(guarded);
    void guarded.finally(() => this.background.delete(guarded));
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/LavalinkTransport.ts

````typescript
import { LavalinkManager } from 'lavalink-client';
import type {
  LavalinkNode,
  LavalinkFilterData,
  Track,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStartEvent,
  TrackStuckEvent,
} from 'lavalink-client';
import type { Env } from '../../config/env.js';
import type { QueueSnapshotsRepository } from '../db/contracts.js';
import type { AudioFilters, PlayableTrack, QueueSnapshot } from '../db/models.js';
import type {
  AudioTransport,
  LoadResult,
  NodeIdentity,
  PlaybackOptions,
  TrackEvent,
} from './types.js';
import { fromClientTrack } from './TrackCodec.js';
import { MusicError } from '../utils/errors.js';

export async function createLavalinkClient(
  env: Env,
  botId: string,
  snapshots: QueueSnapshotsRepository,
  sendToShard: ConstructorParameters<typeof LavalinkManager>[0]['sendToShard'],
  ownsGuild: (guildId: string) => boolean = () => true,
): Promise<LavalinkManager> {
  const sessions = new Map<string, string>();
  // Newest snapshot wins if an older player has not yet checkpointed a reconnected node.
  for (const summary of (await snapshots.list(botId)).sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (!ownsGuild(summary.guildId)) continue;
    const record = await snapshots.load(botId, summary.guildId);
    if (
      record?.snapshot.nodeId &&
      record.snapshot.nodeSessionId &&
      !sessions.has(record.snapshot.nodeId)
    )
      sessions.set(record.snapshot.nodeId, record.snapshot.nodeSessionId);
  }
  return new LavalinkManager({
    nodes: env.lavalinkNodes.map((node) => ({
      ...node,
      host: node.host.includes(':') && !node.host.startsWith('[') ? `[${node.host}]` : node.host,
      requestSignalTimeoutMS: env.LAVALINK_REQUEST_TIMEOUT_MS,
      ...(sessions.has(node.id) ? { sessionId: sessions.get(node.id) ?? '' } : {}),
    })),
    sendToShard,
    autoSkip: false,
    autoSkipOnResolveError: false,
    autoMove: false,
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      allowCustomSources: true,
      volumeDecrementer: 1,
      clientBasedPositionUpdateInterval: 250,
      onDisconnect: { autoReconnect: false, destroyPlayer: false },
      maxErrorsPerTime: { threshold: 0, maxAmount: 0 },
      enforceSponsorBlockRequestForEventEnablement: false,
    },
    queueOptions: { maxPreviousTracks: 0 },
    advancedOptions: { enableDebugEvents: false },
  });
}

/** SDK handles nodes and Discord voice. Our engine handles tracks via the typed v4 REST API. */
export class LavalinkTransport implements AudioTransport {
  private readonly stuckCleanup = new Map<
    string,
    {
      done: Promise<boolean>;
      release: (completed: boolean) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(public readonly client: LavalinkManager) {
    // The SDK sends an automatic stop after emitting trackStuck, even with autoSkip=false.
    // Wait for its resulting queueEnd before our next PATCH so that stop cannot kill a new mirror.
    client.on('trackStuck', (player) => {
      this.releaseStuck(player.guildId, false);
      let release!: (completed: boolean) => void;
      const done = new Promise<boolean>((ready) => {
        release = ready;
      });
      const timeout = (player.node.options.requestSignalTimeoutMS ?? 30_000) + 1000;
      const timer = setTimeout(() => this.releaseStuck(player.guildId, false), timeout);
      timer.unref();
      this.stuckCleanup.set(player.guildId, { done, release, timer });
    });
    client.on('queueEnd', (player, _track, payload) => {
      if (
        payload.type === 'TrackStuckEvent' ||
        (payload.type === 'TrackEndEvent' && payload.reason === 'stopped')
      )
        this.releaseStuck(player.guildId, true);
    });
    client.on('playerDestroy', (player) => this.releaseStuck(player.guildId, false));
  }

  private releaseStuck(guildId: string, completed: boolean): void {
    const pending = this.stuckCleanup.get(guildId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.stuckCleanup.delete(guildId);
    pending.release(completed);
  }
  private async waitForStuckCleanup(guildId: string): Promise<void> {
    const pending = this.stuckCleanup.get(guildId);
    if (pending && !(await pending.done))
      throw new MusicError('NODE_UNAVAILABLE', 'The audio server is reconnecting.');
  }

  private node(preferred?: string | null): LavalinkNode {
    const requested = preferred ? this.client.nodeManager.getNode(preferred) : undefined;
    const node =
      requested?.connected && requested.sessionId && requested.info
        ? requested
        : this.client.nodeManager
            .leastUsedNodes('players')
            .find((candidate) => candidate.connected && candidate.sessionId && candidate.info);
    if (!node)
      throw new MusicError(
        'NODE_UNAVAILABLE',
        'The audio server is reconnecting. Please try again shortly.',
      );
    return node;
  }
  async load(identifier: string, nodeId?: string | null): Promise<LoadResult> {
    try {
      const result = await this.node(nodeId).search({ query: identifier }, null, false);
      if (result.loadType === 'error')
        throw new MusicError('UNAVAILABLE', 'This track or playlist is unavailable.');
      const tracks = result.tracks.map(fromClientTrack);
      return {
        kind:
          result.loadType === 'playlist'
            ? 'playlist'
            : result.loadType === 'search'
              ? 'search'
              : tracks.length
                ? 'track'
                : 'empty',
        name: result.playlist?.name ?? 'Search results',
        tracks,
      };
    } catch (error) {
      if (error instanceof MusicError) throw error;
      throw new MusicError('UNAVAILABLE', 'The audio source could not be loaded.');
    }
  }
  async connect(snapshot: QueueSnapshot): Promise<NodeIdentity> {
    const node = this.node(snapshot.nodeId);
    const player =
      this.client.getPlayer(snapshot.guildId) ??
      this.client.createPlayer({
        guildId: snapshot.guildId,
        voiceChannelId: snapshot.voiceChannelId,
        ...(snapshot.textChannelId ? { textChannelId: snapshot.textChannelId } : {}),
        node,
        volume: snapshot.volume,
        selfDeaf: true,
        selfMute: false,
      });
    if (player.voiceChannelId !== snapshot.voiceChannelId)
      await player.changeVoiceState({ voiceChannelId: snapshot.voiceChannelId, selfDeaf: true });
    else await player.connect();
    const deadline = Date.now() + 15_000;
    while (!player.voice.token || !player.voice.sessionId || !player.voice.endpoint) {
      if (Date.now() >= deadline)
        throw new MusicError(
          'UNAVAILABLE',
          'Voice connection timed out. Check Connect and Speak permissions.',
        );
      await new Promise<void>((ready) => setTimeout(ready, 100));
    }
    return this.identity(snapshot.guildId);
  }
  async play(guildId: string, track: PlayableTrack, options: PlaybackOptions): Promise<void> {
    await this.waitForStuckCleanup(guildId);
    const player = this.requirePlayer(guildId);
    // The SDK may expose the current track for diagnostics; all upcoming entries stay in our queue.
    player.queue.current = {
      ...toClientTrack(track),
      userData: { playbackId: options.playbackId },
    };
    try {
      await player.node.updatePlayer({
        guildId,
        noReplace: false,
        playerOptions: {
          track: { encoded: track.encoded, userData: { playbackId: options.playbackId } },
          position: options.positionMs,
          paused: options.paused,
          volume: options.volume,
          filters: clientFilters(options.filters),
          voice: player.voice,
        },
      });
    } catch {
      throw new MusicError(
        'NODE_UNAVAILABLE',
        'The audio server could not start playback. Your queue is saved.',
      );
    }
    player.lastPosition = options.positionMs;
    player.lastPositionChange = Date.now();
    player.paused = options.paused;
    player.playing = !options.paused;
  }
  async stop(guildId: string): Promise<void> {
    await this.waitForStuckCleanup(guildId);
    const player = this.client.getPlayer(guildId);
    if (player?.node.connected)
      await player.node.updatePlayer({ guildId, playerOptions: { track: { encoded: null } } });
    if (player) {
      player.queue.current = null;
      player.playing = false;
      player.paused = false;
      player.lastPosition = 0;
    }
  }
  async destroy(guildId: string): Promise<void> {
    await this.client.getPlayer(guildId)?.destroy('Requested disconnect');
  }
  async pause(guildId: string, paused: boolean): Promise<void> {
    const player = this.requirePlayer(guildId);
    await player.node.updatePlayer({ guildId, playerOptions: { paused } });
    player.paused = paused;
    player.playing = !paused;
  }
  async seek(guildId: string, positionMs: number): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({
      guildId,
      playerOptions: { position: positionMs },
    });
  }
  async volume(guildId: string, volume: number): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({ guildId, playerOptions: { volume } });
  }
  async filters(guildId: string, filters: AudioFilters): Promise<void> {
    await this.requirePlayer(guildId).node.updatePlayer({
      guildId,
      playerOptions: { filters: clientFilters(filters) },
    });
  }
  async sponsorBlock(guildId: string, enabled: boolean): Promise<void> {
    const player = this.requirePlayer(guildId);
    if (enabled) await player.setSponsorBlock(['sponsor', 'selfpromo', 'interaction']);
    else if (player.node.info?.plugins.some((plugin) => plugin.name === 'sponsorblock-plugin'))
      await player.deleteSponsorBlock();
  }
  identity(guildId: string): NodeIdentity {
    const player = this.client.getPlayer(guildId);
    return { nodeId: player?.node.id ?? null, sessionId: player?.node.sessionId ?? null };
  }
  position(guildId: string): number | null {
    const player = this.client.getPlayer(guildId);
    return player?.node.connected && Number.isFinite(player.position)
      ? Math.max(0, Math.round(player.position))
      : null;
  }
  async migrate(guildId: string, excludedNodeId: string): Promise<NodeIdentity | null> {
    const player = this.client.getPlayer(guildId);
    const target = this.client.nodeManager
      .leastUsedNodes('players')
      .find((node) => node.id !== excludedNodeId && node.connected && node.sessionId);
    if (!player || !target) return null;
    await player.changeNode(target, false);
    return this.identity(guildId);
  }
  private requirePlayer(guildId: string) {
    const player = this.client.getPlayer(guildId);
    if (!player) throw new MusicError('NO_PLAYER', 'Join a voice channel and play a track first.');
    if (!player.node.connected)
      throw new MusicError('NODE_UNAVAILABLE', 'The audio server is reconnecting.');
    return player;
  }

  /** Call AFTER PlayerManager.close(). Remove local SDK state before destroying sockets,
   * so the SDK cannot send DELETE requests for remote players we want to resume. */
  close(): void {
    for (const guildId of this.stuckCleanup.keys()) this.releaseStuck(guildId, false);
    this.client.players.clear();
    for (const node of [...this.client.nodeManager.nodes.values()]) node.destroy('BotShutdown');
  }
}

/** In 2.11.0 `connect` can precede the v4 ready payload. Session PATCH/recovery needs both. */
export function observeNodeReady(
  client: LavalinkManager,
  ready: (node: LavalinkNode) => Promise<void>,
  failed: (nodeId: string) => void,
): () => void {
  const status = new Map<
    string,
    { node: LavalinkNode; sessionId: string | null; info: boolean; fired: boolean }
  >();
  const state = (node: LavalinkNode) => {
    let value = status.get(node.id);
    if (!value) {
      value = { node, sessionId: null, info: false, fired: false };
      status.set(node.id, value);
    }
    return value;
  };
  const dispatch = (node: LavalinkNode) => {
    const value = state(node);
    if (
      value.fired ||
      !value.info ||
      !value.sessionId ||
      node.sessionId !== value.sessionId ||
      !node.connected
    )
      return;
    value.fired = true;
    void ready(node).catch(() => failed(node.id));
  };
  const connect = (node: LavalinkNode) => {
    state(node).info = node.info !== null;
    dispatch(node);
  };
  const raw = (node: LavalinkNode, payload: unknown) => {
    if (
      typeof payload !== 'object' ||
      !payload ||
      !('op' in payload) ||
      payload.op !== 'ready' ||
      !('sessionId' in payload) ||
      typeof payload.sessionId !== 'string'
    )
      return;
    const sessionId = payload.sessionId;
    // SDK assigns sessionId immediately after emitting raw; defer until that assignment completes.
    queueMicrotask(() => {
      state(node).sessionId = sessionId;
      dispatch(node);
    });
  };
  const disconnect = (node: LavalinkNode) => {
    status.delete(node.id);
  };
  client.nodeManager.on('connect', connect);
  client.nodeManager.on('raw', raw);
  client.nodeManager.on('disconnect', disconnect);
  return () => {
    client.nodeManager.off('connect', connect);
    client.nodeManager.off('raw', raw);
    client.nodeManager.off('disconnect', disconnect);
    status.clear();
  };
}

/** Identity comes from the event payload, never the mutable SDK queue after a rapid skip. */
export function trackEvent(
  payload: TrackStartEvent | TrackEndEvent | TrackExceptionEvent | TrackStuckEvent,
): TrackEvent {
  const id: unknown = payload.track.userData?.['playbackId'];
  return {
    guildId: payload.guildId,
    playbackId: typeof id === 'string' ? id : null,
    encoded: payload.track.encoded ?? null,
    type:
      payload.type === 'TrackStartEvent'
        ? 'start'
        : payload.type === 'TrackEndEvent'
          ? 'end'
          : payload.type === 'TrackStuckEvent'
            ? 'stuck'
            : 'error',
    reason: payload.type === 'TrackEndEvent' ? payload.reason : null,
  };
}

export function toClientTrack(track: PlayableTrack): Track {
  return {
    encoded: track.encoded,
    info: {
      identifier: track.identifier,
      title: track.title,
      author: track.artist,
      sourceName: track.source as Track['info']['sourceName'],
      uri: track.uri ?? '',
      duration: track.durationMs,
      isStream: track.isStream,
      isSeekable: track.isSeekable,
      artworkUrl: track.artworkUrl,
      isrc: track.isrc,
    },
    pluginInfo: {},
  };
}

function clientFilters(filters: AudioFilters): Partial<LavalinkFilterData> {
  return {
    ...(filters.equalizer ? { equalizer: filters.equalizer } : {}),
    ...(filters.timescale ? { timescale: filters.timescale } : {}),
    ...(filters.karaoke ? { karaoke: filters.karaoke } : {}),
    ...(filters.tremolo ? { tremolo: filters.tremolo } : {}),
    ...(filters.vibrato ? { vibrato: filters.vibrato } : {}),
    ...(filters.rotation ? { rotation: filters.rotation } : {}),
    ...(filters.lowPass ? { lowPass: filters.lowPass } : {}),
    ...(filters.channelMix ? { channelMix: filters.channelMix } : {}),
  };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/RecoveryManager.ts

````typescript
import type { Logger } from 'pino';
import type { QueueSnapshotsRepository } from '../db/contracts.js';
import type { SnapshotSummary } from '../db/models.js';
import type { PlayerManager } from './PlayerManager.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { errorCode } from '../utils/errors.js';

/** The Discord adapter checks shard ownership, guild membership, voice permissions, and stage readiness. */
export type RecoveryGuard = (snapshot: SnapshotSummary) => Promise<boolean>;
export class RecoveryManager {
  private readonly lock = new AsyncLock();
  private closing = false;
  stop(): void {
    this.closing = true;
  }
  constructor(
    private readonly players: PlayerManager,
    private readonly snapshots: QueueSnapshotsRepository,
    private readonly guard: RecoveryGuard,
    private readonly logger: Logger,
  ) {}
  async restoreAll(): Promise<{ restored: number; deferred: number }> {
    return this.lock.run(async () => {
      let restored = 0;
      let deferred = 0;
      for (const summary of await this.snapshots.list(this.players.botId)) {
        if (this.closing) break;
        if (this.players.view(summary.guildId)) continue;
        try {
          if (!(await this.guard(summary))) {
            deferred++;
            continue;
          }
          const record = await this.snapshots.load(this.players.botId, summary.guildId);
          if (this.closing) break;
          if (!record) continue;
          await this.players.restore(record);
          restored++;
        } catch (error) {
          deferred++;
          this.logger.warn(
            { guildId: summary.guildId, code: errorCode(error) },
            'Saved player recovery deferred.',
          );
        }
      }
      return { restored, deferred };
    });
  }
  /** Use on node-ready and at a bounded retry interval; retained snapshots are never deleted on failure. */
  async retryOffline(): Promise<void> {
    if (this.closing) return;
    for (const id of this.players.offlineNodeIds()) {
      if (this.closing) return;
      await this.players
        .nodeConnected(id, true)
        .catch((error: unknown) =>
          this.logger.warn({ nodeId: id, code: errorCode(error) }, 'Node recovery deferred.'),
        );
    }
    await this.restoreAll();
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/TrackCodec.ts

````typescript
import { cleanText, safeWebUrl } from '../utils/text.js';
export { cleanText, safeWebUrl } from '../utils/text.js';
import { createHash } from 'node:crypto';
import type { Track } from 'lavalink-client';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { MusicSource, PlayableTrack, StoredTrack } from '../db/models.js';
import type { RawTrack, ResolvedItem } from './types.js';
import { MusicError } from '../utils/errors.js';
import { isPreviewRequest } from './PreviewPolicy.js';
export { isPreviewRequest } from './PreviewPolicy.js';

export const catalogSources = new Set<MusicSource>([
  'spotify',
  'applemusic',
  'deezer',
  'yandexmusic',
]);
export const mirrorSources = new Set<MusicSource>(['youtube', 'soundcloud']);

export function normalizeSource(value: string): MusicSource {
  const normalized = value.toLowerCase().replace(/[ _-]/g, '');
  if (['youtube', 'youtubemusic'].includes(normalized)) return 'youtube';
  if (
    [
      'spotify',
      'soundcloud',
      'deezer',
      'applemusic',
      'yandexmusic',
      'twitch',
      'bandcamp',
      'vimeo',
      'http',
      'attachment',
    ].includes(normalized)
  )
    return normalized as MusicSource;
  throw new MusicError('UNAVAILABLE', 'This audio source is not supported.');
}
export function normalizeIsrc(value: string | null | undefined): string | null {
  const isrc = value?.replace(/-/g, '').toUpperCase() ?? '';
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : null;
}
export function fromClientTrack(track: Track): RawTrack {
  return {
    encoded: track.encoded ?? null,
    identifier: track.info.identifier,
    title: track.info.title,
    artist: track.info.author,
    source: track.info.sourceName,
    uri: track.info.uri,
    durationMs: track.info.duration,
    isStream: track.info.isStream,
    isSeekable: track.info.isSeekable,
    artworkUrl: track.info.artworkUrl,
    isrc: track.info.isrc,
    album: track.pluginInfo.albumName ?? null,
    // previewUrl alone is metadata, not evidence that this encoded track is a preview.
    isPreview: track.pluginInfo.isPreview === true,
  };
}
export function isPreview(track: RawTrack): boolean {
  return track.isPreview || isPreviewRequest(track.title, track.uri);
}
export function toStoredTrack(raw: RawTrack): StoredTrack {
  const source = normalizeSource(raw.source);
  const identifier = cleanText(raw.identifier, 1024);
  return storedTrackSchema.parse({
    version: 1,
    key: `${source}:${createHash('sha256').update(identifier).digest('hex')}`,
    title: cleanText(raw.title),
    artist: cleanText(raw.artist),
    source,
    identifier,
    uri: safeWebUrl(raw.uri),
    durationMs: Math.round(raw.durationMs),
    isStream: raw.isStream,
    artworkUrl: safeWebUrl(raw.artworkUrl),
    isrc: normalizeIsrc(raw.isrc),
    album: raw.album ? cleanText(raw.album) : null,
    localFileId: null,
  });
}
export function toPlayableTrack(raw: RawTrack): PlayableTrack {
  const track = toStoredTrack(raw);
  if (catalogSources.has(track.source) || isPreview(raw) || !raw.encoded) {
    throw new MusicError('UNAVAILABLE', 'A full playable version could not be found.');
  }
  return playableTrackSchema.parse({
    encoded: raw.encoded,
    identifier: track.identifier,
    title: track.title,
    artist: track.artist,
    source: track.source,
    uri: track.uri,
    durationMs: track.durationMs,
    isStream: track.isStream,
    isSeekable: raw.isSeekable,
    artworkUrl: track.artworkUrl,
    isrc: track.isrc,
    isPreview: false,
  });
}
export function toResolvedItem(raw: RawTrack): ResolvedItem {
  if (isPreview(raw) && !catalogSources.has(normalizeSource(raw.source))) {
    throw new MusicError('UNAVAILABLE', 'Preview clips are not playable.');
  }
  const track = toStoredTrack(raw);
  return { track, playable: catalogSources.has(track.source) ? null : toPlayableTrack(raw) };
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/PreviewPolicy.ts

````typescript
/** Clip hints are checked before a provider URL can be hidden behind the media cache. */
export function isPreviewRequest(title: string, uri: string | null): boolean {
  if (/(?:^|[\W_])(?:preview|sample clip|30[ -]second clip)(?:[\W_]|$)/i.test(title)) return true;
  try {
    const host = uri ? new URL(uri).hostname.toLowerCase() : '';
    return /^(?:p\.scdn\.co|audio-ssl\.itunes\.apple\.com|cdns-preview[^.]*\.dzcdn\.net)$/.test(
      host,
    );
  } catch {
    return false;
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/security/MediaBridge.ts

````typescript
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from './SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';
import { isPreviewRequest } from '../music/PreviewPolicy.js';

const idSchema = z.uuid();
export interface CachedMedia {
  id: string;
  url: string;
  size: number;
}

/** Lavalink sees only immutable, bounded files, never arbitrary user download URLs or manifests. */
export class MediaBridge {
  private server: Server | null = null;
  private key: Buffer | null = null;
  private readonly lock = new AsyncLock();
  private readonly directory: string;
  constructor(
    private readonly env: Pick<
      Env,
      | 'MEDIA_BRIDGE_PORT'
      | 'MEDIA_BRIDGE_BIND'
      | 'MEDIA_BRIDGE_PUBLIC_URL'
      | 'MEDIA_MAX_BYTES'
      | 'MEDIA_REQUEST_TIMEOUT_MS'
    >,
    private readonly http = new SafeHttpClient(),
    directory = './media-cache',
  ) {
    this.directory = resolve(directory);
  }

  /** Shard children load the shared key; only the supervisor binds the HTTP port. */
  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const keyPath = join(this.directory, '.bridge-key');
    try {
      await writeFile(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    this.key = await readFile(keyPath);
    if (this.key.length !== 32) throw new Error('Invalid media bridge key.');
  }
  async start(): Promise<void> {
    if (this.server) return;
    await this.initialize();
    const server = createServer((request, response) => {
      void this.serve(request, response).catch(() => {
        response.destroy();
      });
    });
    server.requestTimeout = 30_000;
    server.headersTimeout = 10_000;
    await new Promise<void>((ready, reject) => {
      server.once('error', reject);
      server.listen(this.env.MEDIA_BRIDGE_PORT, this.env.MEDIA_BRIDGE_BIND, () => {
        server.off('error', reject);
        ready();
      });
    });
    server.on('error', () => {
      /* Socket-level failures must not crash the bot. */
    });
    this.server = server;
  }

  async download(url: string, signal?: AbortSignal): Promise<CachedMedia> {
    return this.lock.run(async () => {
      if (!this.key) throw new Error('Start the media bridge before downloading.');
      const response = await this.http.request(url, {
        maxBytes: this.env.MEDIA_MAX_BYTES,
        timeoutMs: this.env.MEDIA_REQUEST_TIMEOUT_MS,
        ...(signal ? { signal } : {}),
      });
      if (isPreviewRequest('', response.url))
        throw new MusicError(
          'UNAVAILABLE',
          'The download redirected to a preview clip. Use a full song link.',
        );
      if (response.status !== 200 || !isAudioContainer(response.body)) {
        throw new MusicError(
          'UNAVAILABLE',
          'Use a complete MP3, AAC, Ogg, FLAC, WAV, MP4, or WebM audio file.',
        );
      }
      const files = await readdir(this.directory);
      let used = 0;
      for (const file of files.filter((file) => /^[a-f0-9-]{36}\.media$/.test(file))) {
        used += (await stat(join(this.directory, file))).size;
      }
      if (used + response.body.length > this.env.MEDIA_MAX_BYTES * 20) {
        throw new MusicError(
          'MEDIA_TOO_LARGE',
          'The media cache is full. Ask the bot owner to clear unused files.',
        );
      }
      const id = randomUUID();
      await writeFile(this.filePath(id), response.body, { flag: 'wx', mode: 0o600 });
      return { id, url: await this.urlFor(id), size: response.body.length };
    });
  }

  async urlFor(id: string): Promise<string> {
    idSchema.parse(id);
    if (!this.key) throw new Error('Media bridge has not started.');
    try {
      await stat(this.filePath(id));
    } catch {
      throw new MusicError(
        'UNAVAILABLE',
        'This uploaded file is no longer available. Upload it again.',
      );
    }
    const signature = createHmac('sha256', this.key).update(id).digest('hex');
    return `${this.env.MEDIA_BRIDGE_PUBLIC_URL}/media/${id}/${signature}`;
  }

  /** Call with IDs referenced by ALL bot snapshots/favorites/playlists, never just one guild. */
  async pruneUnused(retained: ReadonlySet<string>, olderThanMs = 7 * 86_400_000): Promise<number> {
    return this.lock.run(async () => {
      let removed = 0;
      for (const file of await readdir(this.directory)) {
        const id = file.replace(/\.media$/, '');
        if (!idSchema.safeParse(id).success || retained.has(id)) continue;
        const path = this.filePath(id);
        if ((await stat(path)).mtimeMs > Date.now() - olderThanMs) continue;
        await unlink(path);
        removed++;
      }
      return removed;
    });
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((ready) => server.close(() => ready()));
    }
  }

  private filePath(id: string): string {
    return join(this.directory, `${idSchema.parse(id)}.media`);
  }
  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const match = /^\/media\/([a-f0-9-]{36})\/([a-f0-9]{64})$/.exec(request.url ?? '');
    if (!match || !this.key || !['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(404).end();
      return;
    }
    const id = match[1] ?? '';
    if (!idSchema.safeParse(id).success) {
      response.writeHead(404).end();
      return;
    }
    const expected = createHmac('sha256', this.key).update(id).digest();
    if (!timingSafeEqual(expected, Buffer.from(match[2] ?? '', 'hex'))) {
      response.writeHead(404).end();
      return;
    }
    let size: number;
    try {
      size = (await stat(this.filePath(id))).size;
    } catch {
      response.writeHead(404).end();
      return;
    }
    let start = 0;
    let end = size - 1;
    let status = 200;
    const range = request.headers.range;
    if (range) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parsed || (!parsed[1] && !parsed[2])) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      if (!parsed[1]) start = Math.max(0, size - Number(parsed[2]));
      else {
        start = Number(parsed[1]);
        end = parsed[2] ? Math.min(Number(parsed[2]), end) : end;
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size
      ) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      status = 206;
    }
    response.writeHead(status, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    await pipeline(createReadStream(this.filePath(id), { start, end }), response);
  }
}

export function isAudioContainer(body: Buffer): boolean {
  if (body.length < 12) return false;
  const header = body.subarray(0, 12);
  const ascii = header.toString('ascii');
  return (
    ascii.startsWith('ID3') ||
    ascii.startsWith('OggS') ||
    ascii.startsWith('fLaC') ||
    (ascii.startsWith('RIFF') && ascii.slice(8) === 'WAVE') ||
    ascii.slice(4, 8) === 'ftyp' ||
    header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ||
    (header[0] === 0xff && ((header[1] ?? 0) & 0xe0) === 0xe0)
  );
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/pause.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl('pause', 'Pause the current track', 'Paused.', async (context) => {
  await context.services.players.pause(
    context.guildId,
    true,
    context.expectedPlaybackId ?? undefined,
  );
});
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/resume.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl('resume', 'Resume the paused track', 'Resumed.', async (context) => {
  await context.services.players.pause(
    context.guildId,
    false,
    context.expectedPlaybackId ?? undefined,
  );
});
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/stop.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl(
  'stop',
  'Stop playback and cancel pending imports',
  'Stopped playback and cleared the queue.',
  async (context) => {
    await context.services.players.stop(context.guildId, context.expectedPlaybackId ?? undefined);
  },
);
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/playback/previous.ts

````typescript
import { makeControl } from '../common.js';
const command = makeControl(
  'previous',
  'Play the previous track',
  'Playing the previous track.',
  async (context) => {
    await context.services.players.previous(
      context.guildId,
      context.expectedPlaybackId ?? undefined,
    );
  },
  { aliases: ['prev'] },
);
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/shuffle.ts

````typescript
import { defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'shuffle',
  description: 'Shuffle upcoming tracks',
  category: 'queue',
  policy: controlPolicy,
  execute: async (context) => {
    await context.services.players.mutateQueue(
      context.guildId,
      (queue) => queue.shuffle(),
      context.expectedPlaybackId ?? undefined,
    );
    await context.notice('Queue shuffled.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/queue/loop.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'loop',
  description: 'Loop the current track, the queue, or neither',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.choice('mode', 'Loop mode', ['off', 'track', 'queue'])],
  execute: async (context) => {
    const mode = context.args.text('mode');
    if (mode !== 'off' && mode !== 'track' && mode !== 'queue') return;
    await context.services.players.loop(
      context.guildId,
      mode,
      context.expectedPlaybackId ?? undefined,
    );
    await context.notice(`Loop mode: ${mode}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/commands/audio/volume.ts

````typescript
import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'volume',
  description: 'Set and save playback volume from 1 to 200 percent',
  category: 'audio',
  aliases: ['vol'],
  policy: controlPolicy,
  arguments: [arg.integer('percent', 'Volume percent', true, 1, 200)],
  execute: async (context) => {
    const volume = context.args.number('percent');
    await context.services.players.volume(
      context.guildId,
      volume,
      context.expectedPlaybackId ?? undefined,
    );
    await context.notice(`Volume: ${volume}%.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/tsup.config.ts

````typescript
import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bot: 'src/bot.ts',
    shard: 'src/shard.ts',
    'config/env': 'src/config/env.ts',
    'scripts/check-env': 'scripts/check-env.ts',
    'scripts/healthcheck': 'scripts/healthcheck.ts',
    'scripts/migrate': 'scripts/migrate.ts',
    'lib/db/index': 'src/lib/db/index.ts',
    'lib/music/index': 'src/lib/music/index.ts',
    'framework/index': 'src/framework/index.ts',
    'scripts/register-commands': 'scripts/register-commands.ts',
    'scripts/youtube-auth': 'scripts/youtube-auth.ts',
    'scripts/spotify-auth': 'scripts/spotify-auth.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  treeshake: true,
  external: ['better-sqlite3', 'pino-pretty'],
  noExternal: ['yaml'],
  onSuccess: () =>
    Promise.resolve().then(() => {
      cpSync('src/lib/db/migrations', 'dist/migrations', { recursive: true });
    }),
});
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/Dockerfile

````dockerfile
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build

FROM base AS production-dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Source migration assets remain available for diagnostics; the runtime uses dist/migrations.
COPY src ./src
RUN mkdir -p /app/data /app/media-cache && chown -R node:node /app/data /app/media-cache
USER node
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "dist/scripts/healthcheck.js"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docker-compose.yml

````yaml
name: discord-music-stream

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    restart: unless-stopped
    init: true
    env_file:
      - .env
    environment:
      NODE_ENV: production
      LOG_PRETTY: 'false'
      LAVALINK_HOST: lavalink
      LAVALINK_PORT: '2333'
      LAVALINK_SECURE: 'false'
      DATABASE_PATH: /app/data/music.sqlite
      REDIS_URL: '${DOCKER_REDIS_URL:-}'
      HEALTH_PORT: '3000'
      MEDIA_BRIDGE_PORT: '3001'
      MEDIA_BRIDGE_BIND: 0.0.0.0
      MEDIA_BRIDGE_PUBLIC_URL: http://bot:3001
    depends_on:
      lavalink:
        condition: service_healthy
    volumes:
      - bot-data:/app/data
      - bot-media:/app/media-cache
    expose:
      - '3000'
      - '3001'
    read_only: true
    tmpfs:
      - /tmp:size=128m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 60s
    healthcheck:
      test: ['CMD', 'node', 'dist/scripts/healthcheck.js']
      interval: 30s
      timeout: 5s
      start_period: 60s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

  lavalink:
    build:
      context: .
      dockerfile: lavalink/Dockerfile
    restart: unless-stopped
    environment:
      LAVALINK_PASSWORD: '${LAVALINK_PASSWORD:?Set LAVALINK_PASSWORD in .env}'
      JAVA_TOOL_OPTIONS: '${LAVALINK_JAVA_OPTIONS:--Xms128m -Xmx512m}'
      SOURCE_COUNTRY_CODE: '${SOURCE_COUNTRY_CODE:-PH}'
      SPOTIFY_ENABLED: '${SPOTIFY_ENABLED:-false}'
      SPOTIFY_CLIENT_ID: '${SPOTIFY_CLIENT_ID:-}'
      SPOTIFY_CLIENT_SECRET: '${SPOTIFY_CLIENT_SECRET:-}'
      SPOTIFY_SP_DC: '${SPOTIFY_SP_DC:-}'
      SPOTIFY_TOKEN_ENDPOINT: '${SPOTIFY_TOKEN_ENDPOINT:-}'
      APPLE_MUSIC_ENABLED: '${APPLE_MUSIC_ENABLED:-false}'
      APPLE_MUSIC_TOKEN: '${APPLE_MUSIC_TOKEN:-}'
      DEEZER_ENABLED: '${DEEZER_ENABLED:-false}'
      DEEZER_ARL: '${DEEZER_ARL:-}'
      DEEZER_MASTER_DECRYPTION_KEY: '${DEEZER_MASTER_DECRYPTION_KEY:-}'
      YANDEX_MUSIC_ENABLED: '${YANDEX_MUSIC_ENABLED:-false}'
      YANDEX_MUSIC_ACCESS_TOKEN: '${YANDEX_MUSIC_ACCESS_TOKEN:-}'
      YOUTUBE_OAUTH_ENABLED: '${YOUTUBE_OAUTH_ENABLED:-false}'
      YOUTUBE_OAUTH_REFRESH_TOKEN: '${YOUTUBE_OAUTH_REFRESH_TOKEN:-}'
      YOUTUBE_OAUTH_SKIP_INITIALIZATION: '${YOUTUBE_OAUTH_SKIP_INITIALIZATION:-false}'
      YOUTUBE_CIPHER_URL: '${YOUTUBE_CIPHER_URL:-http://cipher:8001}'
      YOUTUBE_CIPHER_PASSWORD: '${YOUTUBE_CIPHER_PASSWORD:-${LAVALINK_PASSWORD}}'
      YOUTUBE_PO_TOKEN: '${YOUTUBE_PO_TOKEN:-}'
      YOUTUBE_VISITOR_DATA: '${YOUTUBE_VISITOR_DATA:-}'
      YOUTUBE_PLAYLIST_PAGES: '${YOUTUBE_PLAYLIST_PAGES:-20}'
      SPOTIFY_PLAYLIST_PAGES: '${SPOTIFY_PLAYLIST_PAGES:-20}'
      SPOTIFY_ALBUM_PAGES: '${SPOTIFY_ALBUM_PAGES:-40}'
      APPLE_MUSIC_PLAYLIST_PAGES: '${APPLE_MUSIC_PLAYLIST_PAGES:-7}'
      APPLE_MUSIC_ALBUM_PAGES: '${APPLE_MUSIC_ALBUM_PAGES:-7}'
      YANDEX_PLAYLIST_PAGES: '${YANDEX_PLAYLIST_PAGES:-20}'
      YANDEX_ALBUM_PAGES: '${YANDEX_ALBUM_PAGES:-40}'
      YANDEX_ARTIST_PAGES: '${YANDEX_ARTIST_PAGES:-10}'
      YOUTUBE_LYRICS_ENABLED: '${YOUTUBE_LYRICS_ENABLED:-true}'
      SPOTIFY_LYRICS_ENABLED: '${SPOTIFY_LYRICS_ENABLED:-false}'
      DEEZER_LYRICS_ENABLED: '${DEEZER_LYRICS_ENABLED:-false}'
      YANDEX_LYRICS_ENABLED: '${YANDEX_LYRICS_ENABLED:-false}'
      LAVALINK_SOURCE_SOCKET_TIMEOUT_MS: '${LAVALINK_SOURCE_SOCKET_TIMEOUT_MS:-30000}'
    depends_on:
      cipher:
        condition: service_started
    volumes:
      - ./lavalink/application.yml:/opt/Lavalink/application.yml:ro
      - lavalink-plugins:/opt/Lavalink/plugins
      - lavalink-logs:/opt/Lavalink/logs
    ports:
      - '127.0.0.1:2333:2333'
    read_only: true
    tmpfs:
      # Lavalink extracts its DAVE/Opus native libraries here; they need executable mappings.
      - /tmp:rw,exec,nosuid,size=256m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 20s
    healthcheck:
      test:
        - CMD-SHELL
        - 'curl --fail --silent --show-error --max-time 4 -H "Authorization: $${LAVALINK_PASSWORD}" http://127.0.0.1:2333/v4/info > /dev/null'
      interval: 15s
      timeout: 5s
      start_period: 120s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

  cipher:
    # Pinned upstream yt-cipher image; update the digest after checking upstream changes.
    image: ghcr.io/kikkia/yt-cipher:master@sha256:4c5ec381ff57336cfc24822d2b526a5ad7cd0171f61065a1bbc87bb736842449
    restart: unless-stopped
    environment:
      HOST: 0.0.0.0
      PORT: '8001'
      API_TOKEN: '${YOUTUBE_CIPHER_PASSWORD:-${LAVALINK_PASSWORD}}'
      MAX_THREADS: '2'
      PREPROCESSED_CACHE_SIZE: '20'
      OVERRIDE_PLAYER_VARIANT: IAS
    ports:
      - '127.0.0.1:8001:8001'
    read_only: true
    tmpfs:
      - /tmp:rw,exec,nosuid,size=128m
      - /home/nonroot/.cache:rw,noexec,nosuid,size=128m,uid=65532,gid=65532,mode=0700
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    stop_grace_period: 10s
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

  redis:
    image: redis:7.4-alpine
    profiles:
      - redis
    restart: unless-stopped
    environment:
      REDIS_PASSWORD: '${REDIS_PASSWORD:-}'
      REDISCLI_AUTH: '${REDIS_PASSWORD:-}'
    command:
      - /bin/sh
      - -ec
      - |
        [ -n "$$REDIS_PASSWORD" ] || { echo 'Set REDIS_PASSWORD before enabling the redis profile.' >&2; exit 1; }
        exec redis-server --appendonly yes --requirepass "$$REDIS_PASSWORD"
    volumes:
      - redis-data:/data
    expose:
      - '6379'
    healthcheck:
      test: ['CMD-SHELL', 'test "$$(redis-cli ping)" = "PONG"']
      interval: 15s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '3'
    networks:
      - music

networks:
  music:
    driver: bridge

volumes:
  bot-data:
  bot-media:
  lavalink-plugins:
  lavalink-logs:
  redis-data:
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/lavalink/application.yml

````yaml
server:
  port: 2333
  address: 0.0.0.0
  http2:
    enabled: false

lavalink:
  pluginsDir: ./plugins
  plugins:
    - dependency: 'dev.lavalink.youtube:youtube-plugin:1.18.2'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
    - dependency: 'com.github.topi314.lavalyrics:lavalyrics-plugin:1.1.0'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
    - dependency: 'com.github.topi314.lavasrc:lavasrc-plugin:4.8.3'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
    - dependency: 'com.github.topi314.sponsorblock:sponsorblock-plugin:3.0.1'
      repository: https://maven.lavalink.dev/releases
      snapshot: false
  server:
    password: '${LAVALINK_PASSWORD}'
    sources:
      youtube: false
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      nico: false
      # Only trusted application-generated media-bridge URLs reach this source.
      http: true
      local: false
    filters:
      volume: true
      equalizer: true
      karaoke: true
      timescale: true
      tremolo: true
      vibrato: true
      distortion: true
      rotation: true
      channelMix: true
      lowPass: true
    nonAllocatingFrameBuffer: false
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    opusEncodingQuality: 10
    resamplingQuality: MEDIUM
    trackStuckThresholdMs: 10000
    useSeekGhosting: true
    youtubePlaylistLoadLimit: '${YOUTUBE_PLAYLIST_PAGES:20}'
    playerUpdateInterval: 5
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
    soundcloudFilterOutPreviewTracks: true
    gc-warnings: true
    timeouts:
      connectTimeoutMs: 10000
      connectionRequestTimeoutMs: 10000
      socketTimeoutMs: '${LAVALINK_SOURCE_SOCKET_TIMEOUT_MS:30000}'

# Plugin configuration belongs at the YAML root, outside lavalink.server.
plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: false
    allowDirectPlaylistIds: false
    clients:
      - MUSIC
      - TV
      - TVHTML5_SIMPLY
      - ANDROID_VR
      - WEB
      - WEBEMBEDDED
    oauth:
      enabled: '${YOUTUBE_OAUTH_ENABLED:false}'
      skipInitialization: '${YOUTUBE_OAUTH_SKIP_INITIALIZATION:false}'
      # bootstrap.sh supplies PLUGINS_YOUTUBE_OAUTH_REFRESHTOKEN only when configured.
      # For a standalone JAR with a token, uncomment:
      # refreshToken: '${YOUTUBE_OAUTH_REFRESH_TOKEN}'
    remoteCipher:
      url: '${YOUTUBE_CIPHER_URL:}'
      password: '${YOUTUBE_CIPHER_PASSWORD:${LAVALINK_PASSWORD}}'
      userAgent: discord-music-stream
    # bootstrap.sh supplies POT_TOKEN/POT_VISITORDATA only when both are nonempty.
    # For a standalone JAR using poToken, uncomment:
    # pot:
    #   token: '${YOUTUBE_PO_TOKEN}'
    #   visitorData: '${YOUTUBE_VISITOR_DATA}'
  lavasrc:
    # The bot applies stricter duration/version matching before playback.
    # These providers are fallback configuration for catalog tracks on Lavalink.
    providers:
      - 'ytmsearch:"%ISRC%"'
      - 'ytsearch:"%ISRC%"'
      - 'ytmsearch:%QUERY%'
      - 'ytsearch:%QUERY%'
      - 'scsearch:%QUERY%'
    sources:
      spotify: '${SPOTIFY_ENABLED:false}'
      applemusic: '${APPLE_MUSIC_ENABLED:false}'
      deezer: '${DEEZER_ENABLED:false}'
      yandexmusic: '${YANDEX_MUSIC_ENABLED:false}'
      youtube: false
      flowerytts: false
      vkmusic: false
      tidal: false
      qobuz: false
      ytdlp: false
      jiosaavn: false
    lyrics-sources:
      spotify: '${SPOTIFY_LYRICS_ENABLED:false}'
      youtube: '${YOUTUBE_LYRICS_ENABLED:true}'
      deezer: '${DEEZER_LYRICS_ENABLED:false}'
      yandexmusic: '${YANDEX_LYRICS_ENABLED:false}'
      vkmusic: false
      lrcLib: true
    spotify:
      clientId: '${SPOTIFY_CLIENT_ID:}'
      clientSecret: '${SPOTIFY_CLIENT_SECRET:}'
      spDc: '${SPOTIFY_SP_DC:}'
      countryCode: '${SOURCE_COUNTRY_CODE:PH}'
      playlistLoadLimit: '${SPOTIFY_PLAYLIST_PAGES:20}'
      albumLoadLimit: '${SPOTIFY_ALBUM_PAGES:40}'
      resolveArtistsInSearch: false
      localFiles: false
      preferPartnerApi: false
      preferV1SearchApi: false
      # bootstrap.sh binds CUSTOMTOKENENDPOINT only when a URL is provided.
    applemusic:
      countryCode: '${SOURCE_COUNTRY_CODE:PH}'
      mediaAPIToken: '${APPLE_MUSIC_TOKEN:}'
      playlistLoadLimit: '${APPLE_MUSIC_PLAYLIST_PAGES:7}'
      albumLoadLimit: '${APPLE_MUSIC_ALBUM_PAGES:7}'
    deezer:
      arl: '${DEEZER_ARL:}'
      masterDecryptionKey: '${DEEZER_MASTER_DECRYPTION_KEY:}'
      formats: ['MP3_320', 'MP3_128']
    yandexmusic:
      accessToken: '${YANDEX_MUSIC_ACCESS_TOKEN:}'
      playlistLoadLimit: '${YANDEX_PLAYLIST_PAGES:20}'
      albumLoadLimit: '${YANDEX_ALBUM_PAGES:40}'
      artistLoadLimit: '${YANDEX_ARTIST_PAGES:10}'
    youtube:
      countryCode: '${SOURCE_COUNTRY_CODE:PH}'
      language: en
  lavalyrics:
    sources:
      - youtube
      - spotify
      - deezer
      - yandexmusic
      # LavaSrc's LRCLIB provider participates as a fallback.

# SponsorBlock is installed but inactive until categories are enabled on a player.
metrics:
  prometheus:
    enabled: false
    endpoint: /metrics

logging:
  level:
    root: INFO
    lavalink: INFO
    dev.lavalink.youtube.http.YoutubeOauth2Handler: INFO
  file:
    path: ./logs
  request:
    enabled: false
    includeHeaders: false
    includeQueryString: false
    includePayload: false
  logback:
    rollingpolicy:
      max-file-size: 10MB
      max-history: 7
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/.env.example

````dockerfile
# Copy to .env. Replace required placeholders; never commit .env.
NODE_ENV=development
DISCORD_TOKEN=replace_with_your_discord_bot_token
DISCORD_CLIENT_ID=replace_with_your_application_id
# Optional guild ID for instant development slash-command registration.
DISCORD_GUILD_ID=
# Comma-separated bot-owner IDs; only owners can administer global blacklists.
OWNER_IDS=
# JSON array of extra bot tokens, not user account tokens. Maximum 10.
EXTRA_BOT_TOKENS=[]
SHARD_COUNT=auto

# Generate a password with: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
LAVALINK_HOST=127.0.0.1
LAVALINK_PORT=2333
LAVALINK_PASSWORD=replace_with_a_random_32_character_password
LAVALINK_SECURE=false
# Optional JSON array. When nonempty, overrides the four single-node settings above.
# Each node: {"id":"primary","host":"127.0.0.1","port":2333,"authorization":"YOUR_RANDOM_PASSWORD","secure":false}
LAVALINK_NODES=[]
LAVALINK_RESUME_TIMEOUT_SECONDS=120
LAVALINK_REQUEST_TIMEOUT_MS=30000

DATABASE_PATH=./data/music.sqlite
# Blank disables Redis. Local and container deployments can use different URLs.
REDIS_URL=
DOCKER_REDIS_URL=
# Set before enabling Docker Compose's redis profile. Use a URL-safe random hex password.
REDIS_PASSWORD=

LOG_LEVEL=info
LOG_PRETTY=true
DEFAULT_PREFIX=!
EMBED_COLOR="#5865F2"
DEFAULT_LANGUAGE=en
DEFAULT_VOLUME=80
MAX_QUEUE_SIZE=2000
MAX_PLAYLIST_IMPORT=2000
MAX_TRACK_LENGTH_SECONDS=7200
AUTO_LEAVE_TIMEOUT_SECONDS=120
COMMAND_COOLDOWN_MS=1500
CONTROLLER_UPDATE_INTERVAL_MS=10000
IMPORT_CONCURRENCY=3
SUPPORT_URL=

HEALTH_PORT=3000
MEDIA_BRIDGE_PORT=3001
MEDIA_BRIDGE_BIND=127.0.0.1
# Must be reachable from every Lavalink node; compose replaces this with http://bot:3001.
MEDIA_BRIDGE_PUBLIC_URL=http://127.0.0.1:3001
MEDIA_MAX_BYTES=104857600
MEDIA_REQUEST_TIMEOUT_MS=30000

# Booleans use true/false. Sources requiring credentials remain disabled until configured.
SOURCE_COUNTRY_CODE=PH
SPOTIFY_ENABLED=false
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
# For public playlists owned by / shared with the operator, authorize with npm run spotify:auth.
# Register this exact redirect in the Spotify application's Settings before running the helper.
SPOTIFY_REFRESH_TOKEN=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
# Optional lyrics cookie and operator-managed HTTPS anonymous-token service.
SPOTIFY_SP_DC=
SPOTIFY_TOKEN_ENDPOINT=
APPLE_MUSIC_ENABLED=false
APPLE_MUSIC_TOKEN=
# The bot's public Deezer metadata adapter does not require these playback credentials.
# These enable the optional LavaSrc direct Deezer source only.
DEEZER_ENABLED=false
DEEZER_ARL=
DEEZER_MASTER_DECRYPTION_KEY=
YANDEX_MUSIC_ENABLED=false
YANDEX_MUSIC_ACCESS_TOKEN=

# OAuth without a refresh token initiates a device flow in Lavalink's logs.
# TV is the first playback-capable YouTube client for OAuth; MUSIC handles search.
YOUTUBE_OAUTH_ENABLED=false
YOUTUBE_OAUTH_REFRESH_TOKEN=
YOUTUBE_OAUTH_SKIP_INITIALIZATION=false
# Compose starts a local yt-cipher service by default; blank values use it and LAVALINK_PASSWORD.
# For a standalone Lavalink JAR with the Compose cipher service, use http://127.0.0.1:8001.
# Override only with a cipher service you operate and trust with signed media URLs.
YOUTUBE_CIPHER_URL=
YOUTUBE_CIPHER_PASSWORD=
# Provide BOTH values when using poToken. Docker bootstrap binds them only when nonempty.
YOUTUBE_PO_TOKEN=
YOUTUBE_VISITOR_DATA=
# Off by default; guilds may opt into sponsor skipping when globally permitted.
SPONSORBLOCK_ENABLED=false

# Lavalink-only configuration, also passed by Compose.
LAVALINK_JAVA_OPTIONS=-Xms128m -Xmx512m
YOUTUBE_PLAYLIST_PAGES=20
SPOTIFY_PLAYLIST_PAGES=20
SPOTIFY_ALBUM_PAGES=40
APPLE_MUSIC_PLAYLIST_PAGES=7
APPLE_MUSIC_ALBUM_PAGES=7
YANDEX_PLAYLIST_PAGES=20
YANDEX_ALBUM_PAGES=40
YANDEX_ARTIST_PAGES=10
YOUTUBE_LYRICS_ENABLED=true
SPOTIFY_LYRICS_ENABLED=false
DEEZER_LYRICS_ENABLED=false
YANDEX_LYRICS_ENABLED=false
# Set higher if your VPS needs more time to load source metadata.
LAVALINK_SOURCE_SOCKET_TIMEOUT_MS=30000
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/config/env.ts

````typescript
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
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/scripts/youtube-auth.ts

````typescript
import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadEnv, ConfigurationError } from '../src/config/env.js';

async function docker(args: string[], overrides: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      windowsHide: true,
      env: { ...process.env, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-1_000_000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Docker timed out. Check Docker Desktop and retry.'));
    }, 150_000);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Docker could not start. Open Docker Desktop and retry.'));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else
        reject(
          new Error(
            'Docker could not start Lavalink. Check Docker Desktop and the service health, then retry.',
          ),
        );
    });
  });
}
/** Update only these keys; preserve every other setting and never print environment contents. */
async function save(values: Readonly<Record<string, string>>): Promise<void> {
  let file: string;
  try {
    file = await readFile('.env', 'utf8');
  } catch {
    throw new Error('Create .env from .env.example before configuring YouTube.');
  }
  const newline = file.includes('\r\n') ? '\r\n' : '\n';
  for (const [key, value] of Object.entries(values)) {
    if (
      ![
        'YOUTUBE_OAUTH_ENABLED',
        'YOUTUBE_OAUTH_SKIP_INITIALIZATION',
        'YOUTUBE_OAUTH_REFRESH_TOKEN',
      ].includes(key)
    )
      throw new Error('Unsupported setting.');
    const pattern = new RegExp(`^${key}\\s*=.*$`, 'm');
    const line = `${key}=${JSON.stringify(value)}`;
    if (pattern.test(file)) file = file.replace(pattern, () => line);
    else file += `${file.endsWith('\n') ? '' : newline}${line}${newline}`;
  }
  const destination = resolve('.env');
  const temporary = `${destination}.youtube-auth-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, file, { mode: 0o600, flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'npm run youtube:auth -- --start   Enable OAuth and show the Google device sign-in code.',
    );
    console.log(
      'npm run youtube:auth -- --save    After sign-in, save the refresh token privately in .env.',
    );
    return;
  }
  if (args.length > 1 || args.some((arg) => !['--start', '--save'].includes(arg)))
    throw new Error('Use --start, --save, or --help.');
  const env = loadEnv();
  if (args[0] === '--save') {
    const node = env.lavalinkNodes[0];
    if (!node) throw new Error('Configure a Lavalink node first.');
    const host =
      node.host.includes(':') && !node.host.startsWith('[') ? `[${node.host}]` : node.host;
    const origin = `${node.secure ? 'https' : 'http'}://${host}:${node.port}`;
    let body: unknown;
    try {
      const response = await fetch(`${origin}/youtube`, {
        headers: { Authorization: node.authorization },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Unavailable.');
      body = await response.json();
    } catch {
      throw new Error('YouTube authorization could not be checked. Verify Lavalink is running.');
    }
    const token: unknown =
      typeof body === 'object' && body && 'refreshToken' in body ? body.refreshToken : null;
    if (typeof token !== 'string' || !/^[A-Za-z0-9._~+/=-]{16,4096}$/.test(token))
      throw new Error(
        'Google sign-in is not complete yet. Finish the device authorization, then run --save again.',
      );
    await save({
      YOUTUBE_OAUTH_ENABLED: 'true',
      YOUTUBE_OAUTH_REFRESH_TOKEN: token,
      YOUTUBE_OAUTH_SKIP_INITIALIZATION: 'true',
    });
    console.log('YouTube refresh token saved privately in .env. Its value was not printed.');
    console.log('You can retry /play now. Restart the bot later to reload its environment.');
    return;
  }
  await save({ YOUTUBE_OAUTH_ENABLED: 'true', YOUTUBE_OAUTH_SKIP_INITIALIZATION: 'false' });
  await docker(
    ['compose', 'up', '-d', '--force-recreate', '--wait', '--wait-timeout', '120', 'lavalink'],
    {
      YOUTUBE_OAUTH_ENABLED: 'true',
      YOUTUBE_OAUTH_SKIP_INITIALIZATION: 'false',
    },
  );
  const logs = await docker(['compose', 'logs', '--no-color', '--since', '3m', 'lavalink']);
  const flow = [
    ...logs.matchAll(/OAUTH INTEGRATION:.*?go to (https:\/\/\S+) and enter code ([A-Z0-9-]+)/gi),
  ].at(-1);
  if (!flow?.[1] || !flow[2]) {
    if (env.YOUTUBE_OAUTH_REFRESH_TOKEN) {
      console.log('YouTube OAuth is enabled using the saved refresh token. Retry /play.');
      return;
    }
    throw new Error(
      'The Google device code is not available yet. Check Lavalink startup and retry --start.',
    );
  }
  const url = new URL(flow[1]);
  if (
    !['www.google.com', 'google.com', 'www.youtube.com', 'youtube.com'].includes(url.hostname) ||
    url.protocol !== 'https:'
  )
    throw new Error('Unexpected authorization address; raw logs were not printed.');
  console.log('Use a separate Google account, as the youtube-source plugin recommends.');
  console.log(`Open ${url.origin}${url.pathname} and enter code: ${flow[2]}`);
  console.log(
    'After approving access, run npm run youtube:auth -- --save to retain it across restarts.',
  );
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'YouTube setup failed.',
  );
  process.exitCode = 1;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/scripts/spotify-auth.ts

````typescript
import { ConfigurationError, loadEnv } from '../src/config/env.js';
import { authorizeSpotify } from '../src/lib/music/SpotifyAuthorization.js';
import { saveOAuthEnv } from '../src/lib/utils/EnvFile.js';
import { MusicError } from '../src/lib/utils/errors.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(
      'npm run spotify:auth   Authorize playlist reading through a local Spotify sign-in.',
    );
    console.log(
      'First register http://127.0.0.1:8888/callback in your Spotify app Settings (or use SPOTIFY_REDIRECT_URI).',
    );
    console.log(
      'Sign in as the owner/collaborator of the public playlist. Refresh tokens are saved privately.',
    );
    return;
  }
  if (args.length)
    throw new MusicError(
      'INVALID_INPUT',
      'Use npm run spotify:auth or npm run spotify:auth -- --help.',
    );
  const env = loadEnv();
  console.log(
    `Register this exact Redirect URI in your Spotify app Settings: ${env.SPOTIFY_REDIRECT_URI}`,
  );
  console.log('Sign in with a Spotify account that owns or collaborates on the public playlist.');
  await authorizeSpotify(
    env,
    (url) => console.log(`Open this Spotify sign-in link:\n${url}`),
    async (refreshToken) => {
      await saveOAuthEnv({ SPOTIFY_ENABLED: 'true', SPOTIFY_REFRESH_TOKEN: refreshToken });
    },
  );
  console.log('Spotify authorization saved privately in .env. No token values were printed.');
  console.log('Restart npm run dev, then retry /play with your public Spotify playlist link.');
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof ConfigurationError || error instanceof MusicError
      ? error.message
      : 'Spotify setup failed. Check the local configuration and try again.',
  );
  process.exitCode = 1;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/SpotifyUserAuth.ts

````typescript
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Env } from '../../config/env.js';
import type { SafeHttpClient } from '../security/SafeHttpClient.js';
import { MusicError } from '../utils/errors.js';
import { spotifyTokenValid } from './SpotifyToken.js';

export type SpotifyAuthEnv = Pick<Env, 'SPOTIFY_CLIENT_ID'> &
  Partial<Pick<Env, 'SPOTIFY_REFRESH_TOKEN' | 'DATABASE_PATH'>>;
interface SavedToken {
  identity: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
}
export const spotifySignInRequired = () =>
  new MusicError(
    'SPOTIFY_AUTH_REQUIRED',
    'Spotify playlist access needs account sign-in. Ask the bot owner to run npm run spotify:auth, then restart the bot.',
  );

/** Private durable tokens. A short file lease serializes refreshes across accounts and shards. */
export class SpotifyUserAuth {
  private readonly path: string;
  private readonly identity: string;
  constructor(
    private readonly env: SpotifyAuthEnv,
    private readonly http: SafeHttpClient,
  ) {
    const directory = dirname(resolve(env.DATABASE_PATH ?? './data/music.sqlite'));
    const application = createHash('sha256')
      .update(env.SPOTIFY_CLIENT_ID ?? '')
      .digest('hex')
      .slice(0, 16);
    this.path = join(directory, `spotify-oauth-${application}.json`);
    this.identity = createHash('sha256')
      .update(`${env.SPOTIFY_CLIENT_ID ?? ''}\0${env.SPOTIFY_REFRESH_TOKEN ?? ''}`)
      .digest('hex');
  }
  async accessToken(signal?: AbortSignal): Promise<string> {
    if (!this.env.SPOTIFY_REFRESH_TOKEN || !this.env.SPOTIFY_CLIENT_ID)
      throw spotifySignInRequired();
    const cached = await this.read();
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
    const release = await this.lock(signal);
    try {
      // Another account/shard may have refreshed while this request waited for the lease.
      const saved = await this.read();
      if (saved && saved.expiresAt > Date.now()) return saved.accessToken;
      const response = await this.http.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        allowedOrigin: 'https://accounts.spotify.com',
        redirects: 0,
        maxBytes: 64 * 1024,
        timeoutMs: 30_000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.env.SPOTIFY_CLIENT_ID,
          refresh_token: saved?.refreshToken ?? this.env.SPOTIFY_REFRESH_TOKEN,
        }).toString(),
        ...(signal ? { signal } : {}),
      });
      if (response.status === 400 || response.status === 401) throw spotifySignInRequired();
      if (response.status !== 200)
        throw new MusicError(
          'UNAVAILABLE',
          'Spotify authorization is temporarily unavailable. Try again later.',
        );
      let body: unknown;
      try {
        body = JSON.parse(response.body.toString('utf8')) as unknown;
      } catch {
        throw spotifySignInRequired();
      }
      if (
        typeof body !== 'object' ||
        !body ||
        !('access_token' in body) ||
        !spotifyTokenValid(body.access_token) ||
        !('expires_in' in body) ||
        typeof body.expires_in !== 'number' ||
        !Number.isFinite(body.expires_in) ||
        body.expires_in <= 0
      )
        throw spotifySignInRequired();
      const replacement = 'refresh_token' in body ? body.refresh_token : undefined;
      if (replacement !== undefined && !spotifyTokenValid(replacement))
        throw spotifySignInRequired();
      if (
        'scope' in body &&
        (typeof body.scope !== 'string' || !body.scope.split(' ').includes('playlist-read-private'))
      )
        throw spotifySignInRequired();
      const record: SavedToken = {
        identity: this.identity,
        accessToken: body.access_token,
        refreshToken: replacement ?? saved?.refreshToken ?? this.env.SPOTIFY_REFRESH_TOKEN,
        expiresAt: Date.now() + Math.max(1, Math.min(body.expires_in, 86_400) - 30) * 1000,
      };
      await this.write(record);
      return record.accessToken;
    } finally {
      await release();
    }
  }
  async invalidate(accessToken: string): Promise<void> {
    const release = await this.lock();
    try {
      const saved = await this.read();
      if (saved?.accessToken === accessToken) await this.write({ ...saved, expiresAt: 0 });
    } finally {
      await release();
    }
  }
  private async read(): Promise<SavedToken | null> {
    try {
      const size = await stat(this.path);
      if (size.size > 32 * 1024) return null;
      const value: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (
        typeof value !== 'object' ||
        !value ||
        !('identity' in value) ||
        value.identity !== this.identity ||
        !('refreshToken' in value) ||
        !spotifyTokenValid(value.refreshToken) ||
        !('accessToken' in value) ||
        !spotifyTokenValid(value.accessToken) ||
        !('expiresAt' in value) ||
        typeof value.expiresAt !== 'number' ||
        !Number.isFinite(value.expiresAt)
      )
        return null;
      return {
        identity: this.identity,
        refreshToken: value.refreshToken,
        accessToken: value.accessToken,
        expiresAt: value.expiresAt,
      };
    } catch {
      return null;
    }
  }
  private async write(value: SavedToken): Promise<void> {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
      await rename(temporary, this.path);
    } catch {
      throw new MusicError(
        'UNAVAILABLE',
        'Spotify authorization could not be saved. Check that the data directory is writable.',
      );
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
  private async lock(signal?: AbortSignal): Promise<() => Promise<void>> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const path = `${this.path}.lock`;
    const lease = randomUUID();
    const deadline = Date.now() + 45_000;
    while (true) {
      signal?.throwIfAborted();
      try {
        await writeFile(path, lease, { flag: 'wx', mode: 0o600 });
        break;
      } catch (error) {
        if (typeof error !== 'object' || !error || !('code' in error) || error.code !== 'EEXIST')
          throw new MusicError(
            'UNAVAILABLE',
            'Spotify authorization requires a writable data directory.',
          );
        // A refresh request has a 30-second deadline; a two-minute lease left by a crashed process is stale.
        const previous = await readFile(path, 'utf8').catch(() => null);
        const previousStat = await stat(path).catch(() => null);
        if (
          previous !== null &&
          previousStat &&
          Date.now() - previousStat.mtimeMs > 120_000 &&
          (await readFile(path, 'utf8').catch(() => null)) === previous
        ) {
          await unlink(path).catch(() => undefined);
          continue;
        }
        if (Date.now() >= deadline)
          throw new MusicError('UNAVAILABLE', 'Spotify authorization is busy. Retry in a moment.');
        await new Promise<void>((ready) => setTimeout(ready, 100));
      }
    }
    return async () => {
      if ((await readFile(path, 'utf8').catch(() => null)) === lease)
        await unlink(path).catch(() => undefined);
    };
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/SpotifyToken.ts

````typescript
/** Validate OAuth response credentials without including their values in diagnostics. */
export const spotifyTokenValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._~+/=-]{16,4096}$/.test(value);
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/SpotifyAuthorization.ts

````typescript
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';
import { MusicError } from '../utils/errors.js';
import { spotifyTokenValid } from './SpotifyToken.js';

/** One local, state-bound PKCE flow. Only the caller receives the refresh credential. */
export async function authorizeSpotify(
  env: Pick<Env, 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_REDIRECT_URI'>,
  onReady: (url: string) => void,
  save: (refreshToken: string) => Promise<void>,
  http = new SafeHttpClient(),
  timeoutMs = 15 * 60 * 1000,
): Promise<void> {
  if (!env.SPOTIFY_CLIENT_ID)
    throw new MusicError(
      'INVALID_INPUT',
      'Configure SPOTIFY_CLIENT_ID before authorizing Spotify.',
    );
  const redirect = new URL(env.SPOTIFY_REDIRECT_URI);
  if (
    redirect.protocol !== 'http:' ||
    redirect.hostname !== '127.0.0.1' ||
    !redirect.port ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash
  )
    throw new MusicError(
      'INVALID_INPUT',
      'Spotify authorization needs an explicit http://127.0.0.1:PORT/callback address.',
    );
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(64).toString('base64url');
  const authorize = new URL('https://accounts.spotify.com/authorize');
  authorize.search = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirect.href,
    scope: 'playlist-read-private playlist-read-collaborative',
    state,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).toString();
  let resolveFlow!: () => void;
  let rejectFlow!: (error: Error) => void;
  const completed = new Promise<void>((ready, failed) => {
    resolveFlow = ready;
    rejectFlow = failed;
  });
  let accepting = true;
  const abort = new AbortController();
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    let url: URL;
    try {
      url = new URL(request.url ?? '/', redirect.origin);
    } catch {
      response.writeHead(400).end('Invalid callback address.');
      return;
    }
    if (
      request.method !== 'GET' ||
      url.origin !== redirect.origin ||
      url.pathname !== redirect.pathname ||
      request.headers.host !== redirect.host
    ) {
      response.writeHead(404).end('Not found.');
      return;
    }
    const receivedState = url.searchParams.get('state') ?? '';
    const validState =
      url.searchParams.getAll('state').length === 1 &&
      Buffer.byteLength(receivedState) === Buffer.byteLength(state) &&
      timingSafeEqual(Buffer.from(receivedState), Buffer.from(state));
    if (!validState) {
      response
        .writeHead(400)
        .end('Invalid authorization state. Use the sign-in link from the terminal.');
      return;
    }
    if (!accepting) {
      response.writeHead(409).end('Authorization is already being processed.');
      return;
    }
    if (url.searchParams.has('error')) {
      accepting = false;
      response
        .writeHead(400)
        .end('Spotify authorization was declined. You can run the helper again.');
      rejectFlow(
        new MusicError(
          'SPOTIFY_AUTH_REQUIRED',
          'Spotify sign-in was declined. Run npm run spotify:auth when ready.',
        ),
      );
      return;
    }
    const code = url.searchParams.get('code');
    if (
      url.searchParams.getAll('code').length !== 1 ||
      !code ||
      code.length > 4096 ||
      !/^[\x21-\x7e]+$/.test(code)
    ) {
      response.writeHead(400).end('Authorization code missing or invalid.');
      return;
    }
    accepting = false;
    void (async () => {
      try {
        const tokenResponse = await http.request('https://accounts.spotify.com/api/token', {
          method: 'POST',
          allowedOrigin: 'https://accounts.spotify.com',
          redirects: 0,
          maxBytes: 64 * 1024,
          signal: abort.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: env.SPOTIFY_CLIENT_ID!,
            code,
            redirect_uri: redirect.href,
            code_verifier: verifier,
          }).toString(),
        });
        if (tokenResponse.status !== 200)
          throw new MusicError(
            'SPOTIFY_AUTH_REQUIRED',
            'Spotify authorization was rejected. Check the application, redirect URI and approved account, then retry.',
          );
        let body: unknown;
        try {
          body = JSON.parse(tokenResponse.body.toString('utf8')) as unknown;
        } catch {
          throw new MusicError(
            'SPOTIFY_AUTH_REQUIRED',
            'Spotify returned an invalid authorization response. Retry sign-in.',
          );
        }
        const token =
          typeof body === 'object' && body !== null && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : {};
        if (
          !spotifyTokenValid(token['refresh_token']) ||
          typeof token['scope'] !== 'string' ||
          !token['scope'].split(' ').includes('playlist-read-private')
        )
          throw new MusicError(
            'SPOTIFY_AUTH_REQUIRED',
            'Spotify did not grant playlist access. Approve playlist permissions and retry.',
          );
        abort.signal.throwIfAborted();
        await save(token['refresh_token']);
        response
          .writeHead(200)
          .end('Spotify authorization saved. You can close this tab and restart the Discord bot.');
        resolveFlow();
      } catch (error) {
        response
          .writeHead(400)
          .end('Spotify authorization could not be saved. Check the terminal for instructions.');
        rejectFlow(
          error instanceof MusicError
            ? error
            : new MusicError(
                'UNAVAILABLE',
                'Spotify authorization could not be saved. Check that .env is writable and retry.',
              ),
        );
      }
    })();
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    abort.abort();
    rejectFlow(new MusicError('SPOTIFY_AUTH_REQUIRED', 'Spotify authorization was cancelled.'));
  };
  try {
    await new Promise<void>((ready, failed) => {
      server.once('error', () =>
        failed(
          new MusicError(
            'UNAVAILABLE',
            'Spotify callback port is unavailable. Close the other authorization helper, or choose another SPOTIFY_REDIRECT_URI port.',
          ),
        ),
      );
      server.listen(Number(redirect.port), '127.0.0.1', ready);
    });
    timer = setTimeout(() => {
      abort.abort();
      rejectFlow(
        new MusicError(
          'SPOTIFY_AUTH_REQUIRED',
          'Spotify sign-in timed out. Run npm run spotify:auth again.',
        ),
      );
    }, timeoutMs);
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    onReady(authorize.href);
    await completed;
  } finally {
    if (timer) clearTimeout(timer);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    accepting = false;
    await new Promise<void>((ready) => {
      server.close(() => ready());
      server.closeAllConnections();
    });
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/CatalogClient.ts

````typescript
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';
import type { CatalogPage, RawTrack } from './types.js';
import { toResolvedItem } from './TrackCodec.js';
import { SpotifyUserAuth, spotifySignInRequired } from './SpotifyUserAuth.js';

export function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}
export function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
export function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Metadata only. Neither access tokens nor preview URLs enter queue entries or cache keys. */
export class CatalogClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly tokenLock = new AsyncLock();
  private readonly userAuth: SpotifyUserAuth;
  constructor(
    private readonly env: Pick<
      Env,
      'SPOTIFY_ENABLED' | 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_CLIENT_SECRET' | 'SOURCE_COUNTRY_CODE'
    > &
      Partial<Pick<Env, 'SPOTIFY_REFRESH_TOKEN' | 'DATABASE_PATH'>>,
    private readonly http = new SafeHttpClient(),
  ) {
    this.userAuth = new SpotifyUserAuth(env, http);
  }

  supports(url: URL): boolean {
    return (
      url.hostname === 'www.deezer.com' ||
      url.hostname === 'deezer.com' ||
      (this.env.SPOTIFY_ENABLED && url.hostname === 'open.spotify.com')
    );
  }

  async *pages(url: URL, limit: number, signal?: AbortSignal): AsyncGenerator<CatalogPage> {
    if (url.hostname.includes('deezer.com')) yield* this.deezer(url, limit, signal);
    else yield* this.spotify(url, limit, signal);
  }

  private async *deezer(
    url: URL,
    limit: number,
    signal?: AbortSignal,
  ): AsyncGenerator<CatalogPage> {
    const match = /^\/(?:[a-z]{2}\/)?(track|album|playlist|artist)\/(\d+)\/?$/.exec(url.pathname);
    if (!match)
      throw new MusicError('INVALID_INPUT', 'Use a Deezer track, album, playlist, or artist link.');
    const kind = match[1] ?? '';
    const id = match[2] ?? '';
    const root = `https://api.deezer.com/${kind}/${id}`;
    if (kind === 'track') {
      const raw = await this.http.json(root, {
        ...(signal ? { signal } : {}),
        allowedOrigin: 'https://api.deezer.com',
      });
      const item = this.deezerTrack(raw);
      yield { name: item.title, items: [toResolvedItem(item)], total: 1 };
      return;
    }
    let offset = 0;
    while (offset < limit) {
      const size = Math.min(offset === 0 ? 5 : 100, limit - offset);
      const suffix = kind === 'artist' ? 'top' : 'tracks';
      const response = object(
        await this.http.json(`${root}/${suffix}?index=${offset}&limit=${size}`, {
          ...(signal ? { signal } : {}),
          allowedOrigin: 'https://api.deezer.com',
        }),
      );
      if (response['error']) throw new MusicError('UNAVAILABLE', 'Deezer metadata is unavailable.');
      const records = array(response['data']);
      if (!records.length) return;
      const items = records.slice(0, size).flatMap((raw) => {
        try {
          return [toResolvedItem(this.deezerTrack(raw))];
        } catch {
          return [];
        }
      });
      yield { name: `Deezer ${kind}`, items, total: number(response['total']) || null };
      offset += records.length;
      if (!response['next'] || records.length < size) return;
    }
  }
  private deezerTrack(value: unknown): RawTrack {
    const track = object(value);
    const artist = object(track['artist']);
    const album = object(track['album']);
    const identifier = track['id'];
    const id =
      typeof identifier === 'number' && Number.isSafeInteger(identifier)
        ? String(identifier)
        : string(identifier);
    if (!/^\d+$/.test(id) || !string(track['title']) || !number(track['duration']))
      throw new MusicError('UNAVAILABLE', 'Deezer metadata is incomplete.');
    return {
      encoded: null,
      identifier: id,
      title: string(track['title']),
      artist: string(artist['name']),
      source: 'deezer',
      uri: `https://www.deezer.com/track/${id}`,
      durationMs: number(track['duration']) * 1000,
      isStream: false,
      isSeekable: true,
      artworkUrl: string(album['cover_xl']) || string(album['cover_big']) || null,
      isrc: string(track['isrc']) || null,
      album: string(album['title']) || null,
      isPreview: false,
    };
  }

  private async *spotify(
    url: URL,
    limit: number,
    signal?: AbortSignal,
  ): AsyncGenerator<CatalogPage> {
    const match =
      /^\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{22})\/?$/.exec(
        url.pathname,
      );
    if (!match)
      throw new MusicError(
        'INVALID_INPUT',
        'Use a Spotify track, album, playlist, or artist link.',
      );
    const kind = match[1] ?? '';
    const id = match[2] ?? '';
    const root = `https://api.spotify.com/v1/${kind}s/${id}`;
    const market = this.env.SOURCE_COUNTRY_CODE;
    let playlistName = `Spotify ${kind}`;
    if (kind === 'playlist' && this.env.SPOTIFY_REFRESH_TOKEN) {
      const playlist = object(await this.spotifyRequest(root, signal));
      // The operator's authorization is shared by the bot; never disclose their private libraries.
      if (playlist['public'] !== true)
        throw new MusicError(
          'SPOTIFY_ACCESS_DENIED',
          'Only public Spotify playlists can be imported. Make this playlist public and sign in with its owner or a collaborator.',
        );
      playlistName = string(playlist['name']) || playlistName;
    }
    if (kind === 'track' || kind === 'artist') {
      const response = await this.spotifyRequest(
        `${root}${kind === 'artist' ? '/top-tracks' : ''}?market=${market}`,
        signal,
      );
      const records = kind === 'track' ? [response] : array(object(response)['tracks']);
      yield {
        name: playlistName,
        items: records.slice(0, limit).flatMap((track) => this.spotifyItem(track)),
        total: records.length,
      };
      return;
    }
    let offset = 0;
    while (offset < limit) {
      const size = Math.min(offset === 0 ? 5 : 50, limit - offset);
      const suffix = kind === 'playlist' ? 'items' : 'tracks';
      const response = object(
        await this.spotifyRequest(
          `${root}/${suffix}?limit=${size}&offset=${offset}&market=${market}`,
          signal,
        ),
      );
      const records = array(response['items']);
      if (!records.length) return;
      yield {
        name: playlistName,
        items: records.slice(0, size).flatMap((record) => {
          const item = object(record);
          return this.spotifyItem(kind === 'playlist' ? (item['item'] ?? item['track']) : record);
        }),
        total: number(response['total']) || null,
      };
      offset += records.length;
      if (!response['next'] || records.length < size) return;
    }
  }
  private spotifyItem(value: unknown) {
    const track = object(value);
    const album = object(track['album']);
    const id = string(track['id']);
    if (
      !/^[A-Za-z0-9]{22}$/.test(id) ||
      track['is_local'] === true ||
      string(track['type']) === 'episode'
    )
      return [];
    const raw: RawTrack = {
      encoded: null,
      identifier: id,
      title: string(track['name']),
      artist: array(track['artists'])
        .map((artist) => string(object(artist)['name']))
        .join(', '),
      source: 'spotify',
      uri: `https://open.spotify.com/track/${id}`,
      durationMs: number(track['duration_ms']),
      isStream: false,
      isSeekable: true,
      artworkUrl: string(object(array(album['images'])[0])['url']) || null,
      isrc: string(object(track['external_ids'])['isrc']) || null,
      album: string(album['name']) || null,
      isPreview: false,
    };
    try {
      return [toResolvedItem(raw)];
    } catch {
      return [];
    }
  }
  private async spotifyRequest(url: string, signal?: AbortSignal): Promise<unknown> {
    let token = await this.accessToken(signal);
    let response = await this.http.request(url, {
      allowedOrigin: 'https://api.spotify.com',
      headers: { Authorization: `Bearer ${token}` },
      ...(signal ? { signal } : {}),
    });
    if (response.status === 401) {
      this.token = null;
      if (this.env.SPOTIFY_REFRESH_TOKEN) await this.userAuth.invalidate(token);
      token = await this.accessToken(signal);
      response = await this.http.request(url, {
        allowedOrigin: 'https://api.spotify.com',
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {}),
      });
    }
    if ([401, 403, 404].includes(response.status) && url.includes('/playlists/')) {
      if (!this.env.SPOTIFY_REFRESH_TOKEN || response.status === 401) throw spotifySignInRequired();
      throw new MusicError(
        'SPOTIFY_ACCESS_DENIED',
        'Spotify cannot read this playlist. Use a public playlist owned by the authorized account, or one it collaborates on. Ask the bot owner to check Spotify app access.',
      );
    }
    if (response.status !== 200)
      throw new MusicError('UNAVAILABLE', 'Spotify metadata access is restricted or unavailable.');
    try {
      return JSON.parse(response.body.toString('utf8')) as unknown;
    } catch {
      throw new MusicError('UNAVAILABLE', 'Spotify metadata is unavailable.');
    }
  }
  private async accessToken(signal?: AbortSignal): Promise<string> {
    if (this.env.SPOTIFY_REFRESH_TOKEN) return this.userAuth.accessToken(signal);
    return this.tokenLock.run(async () => {
      if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
      if (!this.env.SPOTIFY_CLIENT_ID || !this.env.SPOTIFY_CLIENT_SECRET)
        throw new MusicError('UNAVAILABLE', 'Spotify is not configured.');
      const auth = Buffer.from(
        `${this.env.SPOTIFY_CLIENT_ID}:${this.env.SPOTIFY_CLIENT_SECRET}`,
      ).toString('base64');
      const response = object(
        await this.http.json('https://accounts.spotify.com/api/token', {
          method: 'POST',
          redirects: 0,
          allowedOrigin: 'https://accounts.spotify.com',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        }),
      );
      const value = string(response['access_token']);
      const expires = number(response['expires_in']);
      if (!value || expires <= 0)
        throw new MusicError('UNAVAILABLE', 'Spotify authentication is unavailable.');
      this.token = { value, expiresAt: Date.now() + Math.max(1, expires - 30) * 1000 };
      return value;
    });
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/SourceResolver.ts

````typescript
import { createHash } from 'node:crypto';
import { playableTrackSchema, storedTrackSchema } from '../db/models.js';
import type { PlayableTrack, StoredTrack } from '../db/models.js';
import type { Cache } from '../cache/Cache.js';
import type { AudioTransport, CatalogPage, RawTrack, ResolvedItem } from './types.js';
import type { CatalogClient } from './CatalogClient.js';
import { MirrorMatcher } from './MirrorMatcher.js';
import {
  catalogSources,
  cleanText,
  isPreviewRequest,
  toPlayableTrack,
  toResolvedItem,
  toStoredTrack,
} from './TrackCodec.js';
import { UrlGuard } from '../security/UrlGuard.js';
import type { MediaBridge } from '../security/MediaBridge.js';
import { Semaphore } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';

const platforms = new Set([
  'ytsearch',
  'ytmsearch',
  'scsearch',
  'spsearch',
  'amsearch',
  'dzsearch',
  'ymsearch',
  'bcsearch',
]);
export class SourceResolver {
  private readonly work: Semaphore;
  constructor(
    private readonly transport: AudioTransport,
    private readonly cache: Cache,
    private readonly media: MediaBridge,
    private readonly catalog: CatalogClient,
    concurrency = 3,
    private readonly guard = new UrlGuard(),
    private readonly matcher = new MirrorMatcher(),
  ) {
    this.work = new Semaphore(concurrency);
  }

  async *pages(input: string, limit: number, signal?: AbortSignal): AsyncGenerator<CatalogPage> {
    const query = this.sanitizeQuery(input);
    signal?.throwIfAborted();
    let identifier = query;
    if (/^https?:\/\//i.test(query)) {
      const { url } = await this.guard.validate(query);
      const provider = canonicalProviderUrl(url);
      if (!provider) {
        if (isPreviewRequest(decodeFilename(url.pathname), url.href))
          throw new MusicError(
            'UNAVAILABLE',
            'Preview clips are not playable. Use a full song link or upload.',
          );
        const cached = await this.media.download(url.href, signal);
        const result = await this.transport.load(cached.url);
        const raw = result.tracks[0];
        if (!raw || raw.isStream)
          throw new MusicError('UNAVAILABLE', 'This file could not be decoded as complete audio.');
        const playable = toPlayableTrack({ ...raw, source: 'http' });
        const track = storedTrackSchema.parse({
          ...toStoredTrack({ ...raw, source: 'http' }),
          key: `http:${cached.id}`,
          uri: null,
          identifier: null,
          localFileId: cached.id,
          title: cleanText(decodeFilename(url.pathname)),
          artist: 'Uploaded audio',
        });
        yield { name: track.title, items: [{ track, playable }], total: 1 };
        return;
      }
      identifier = provider;
      const canonical = new URL(provider);
      if (this.catalog.supports(canonical)) {
        let yielded = false;
        try {
          for await (const page of this.catalog.pages(canonical, limit, signal)) {
            yielded = true;
            yield page;
          }
          return;
        } catch (error) {
          signal?.throwIfAborted();
          if (
            error instanceof MusicError &&
            ['SPOTIFY_AUTH_REQUIRED', 'SPOTIFY_ACCESS_DENIED'].includes(error.code)
          )
            throw error;
          // Fall back only before the first page, so a partial failure cannot duplicate the import.
          if (yielded || !canonical.hostname.includes('spotify')) throw error;
        }
      }
    } else if (!/^[a-z]+search:/i.test(query)) identifier = `ytsearch:${query}`;
    signal?.throwIfAborted();
    const result = await this.transport.load(identifier);
    const items = result.tracks.slice(0, result.kind === 'search' ? 1 : limit).flatMap((raw) => {
      try {
        return [toResolvedItem(raw)];
      } catch {
        return [];
      }
    });
    if (!items.length)
      throw new MusicError('NOT_FOUND', 'No full tracks were found. Try another title or link.');
    // Lavalink's loadtracks endpoint returns aggregated metadata. Only mirror resolution is lazy here.
    for (let offset = 0; offset < items.length; offset += offset === 0 ? 5 : 50) {
      signal?.throwIfAborted();
      const size = offset === 0 ? 5 : 50;
      yield {
        name: cleanText(result.name),
        items: items.slice(offset, offset + size),
        total: items.length,
      };
    }
  }

  async search(
    input: string,
    count = 10,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<ResolvedItem[]> {
    signal?.throwIfAborted();
    const query = this.sanitizeQuery(input);
    if (/^https?:\/\//i.test(query))
      throw new MusicError('INVALID_INPUT', 'Search with a title and artist. Use play for links.');
    const result = await this.transport.load(
      /^[a-z]+search:/i.test(query) ? query : `ytsearch:${query}`,
      nodeId,
    );
    signal?.throwIfAborted();
    return result.tracks.slice(0, Math.max(1, Math.min(10, count))).flatMap((raw) => {
      try {
        return [toResolvedItem(raw)];
      } catch {
        return [];
      }
    });
  }

  async resolve(
    track: StoredTrack,
    excluded: ReadonlySet<string> = new Set(),
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<PlayableTrack> {
    return this.work.run(async () => {
      storedTrackSchema.parse(track);
      signal?.throwIfAborted();
      if (track.localFileId) {
        const result = await this.transport.load(
          await this.media.urlFor(track.localFileId),
          nodeId,
        );
        const raw = result.tracks[0];
        if (!raw) throw unavailable();
        return toPlayableTrack({
          ...raw,
          source: track.source === 'attachment' ? 'attachment' : 'http',
        });
      }
      if (!catalogSources.has(track.source)) {
        if (!track.uri) throw unavailable();
        // Restore never hands an arbitrary saved HTTP URL or encoding to Lavalink.
        const { url } = await this.guard.validate(track.uri);
        const canonical = canonicalProviderUrl(url);
        if (!canonical) throw unavailable();
        const result = await this.transport.load(canonical, nodeId);
        const raw =
          result.tracks.find(
            (candidate) =>
              !excluded.has(candidate.encoded ?? '') && candidate.identifier === track.identifier,
          ) ?? result.tracks.find((candidate) => !excluded.has(candidate.encoded ?? ''));
        if (!raw) throw unavailable();
        return toPlayableTrack(raw);
      }
      const key = `mirror:v1:${createHash('sha256')
        .update(
          JSON.stringify([track.key, track.title, track.artist, track.durationMs, track.isrc]),
        )
        .digest('hex')}`;
      const cached = playableTrackSchema.safeParse(await this.cache.get(key));
      if (
        cached.success &&
        !excluded.has(cached.data.encoded) &&
        this.validMirror(track, cached.data)
      )
        return cached.data;
      const candidates: RawTrack[] = [];
      const query = `${track.artist} - ${track.title}`;
      const searches = [
        ...(track.isrc ? [`ytmsearch:"${track.isrc}"`, `ytsearch:"${track.isrc}"`] : []),
        `ytmsearch:${query}`,
        `ytsearch:${query}`,
        `scsearch:${query}`,
      ];
      for (const search of searches) {
        signal?.throwIfAborted();
        try {
          const result = await this.transport.load(search, nodeId);
          candidates.push(
            ...result.tracks.filter((candidate) => !excluded.has(candidate.encoded ?? '')),
          );
        } catch (error) {
          if (error instanceof MusicError && error.code === 'NODE_UNAVAILABLE') throw error;
        }
        const best = this.matcher.rank(track, candidates)[0];
        if (best && (best.exactIsrc || !search.includes(track.isrc ?? '\u0000'))) {
          const playable = toPlayableTrack(best.candidate);
          await this.cache.set(key, playable, 1800);
          return playable;
        }
      }
      const best = this.matcher.rank(track, candidates)[0];
      if (!best) throw unavailable();
      const playable = toPlayableTrack(best.candidate);
      await this.cache.set(key, playable, 1800);
      return playable;
    }, signal);
  }

  validMirror(track: StoredTrack, playable: PlayableTrack): boolean {
    return (
      this.matcher.score(track, {
        ...playable,
        encoded: playable.encoded,
        source: playable.source,
        album: null,
        isPreview: false,
      }) !== null
    );
  }

  async attachment(url: string, filename: string, signal?: AbortSignal): Promise<ResolvedItem> {
    if (isPreviewRequest(filename, url))
      throw new MusicError(
        'UNAVAILABLE',
        'Preview clips are not playable. Upload a complete song.',
      );
    const cached = await this.media.download(url, signal);
    const result = await this.transport.load(cached.url);
    const raw = result.tracks[0];
    if (!raw || raw.isStream) throw unavailable();
    return {
      track: storedTrackSchema.parse({
        ...toStoredTrack({ ...raw, source: 'attachment' }),
        key: `attachment:${cached.id}`,
        identifier: null,
        uri: null,
        localFileId: cached.id,
        title: cleanText(filename),
        artist: 'Uploaded audio',
      }),
      playable: toPlayableTrack({ ...raw, source: 'attachment' }),
    };
  }

  async related(
    track: StoredTrack,
    nodeId?: string | null,
    signal?: AbortSignal,
  ): Promise<ResolvedItem[]> {
    signal?.throwIfAborted();
    if (
      track.source === 'youtube' &&
      track.identifier &&
      /^[A-Za-z0-9_-]{11}$/.test(track.identifier)
    ) {
      try {
        const result = await this.transport.load(
          `https://www.youtube.com/watch?v=${track.identifier}&list=RD${track.identifier}`,
          nodeId,
        );
        signal?.throwIfAborted();
        const items = result.tracks.slice(0, 30).flatMap((raw) => {
          try {
            return [toResolvedItem(raw)];
          } catch {
            return [];
          }
        });
        if (items.length > 1) return items;
      } catch {
        /* Artist search remains available when mixes are restricted. */
      }
    }
    return this.search(`${track.artist} official audio`, 10, nodeId, signal);
  }

  private sanitizeQuery(input: string): string {
    const query = input.trim();
    if (
      !query ||
      query.length > 4096 ||
      [...query].some((c) => {
        const p = c.codePointAt(0) ?? 0;
        return p < 32 || p === 127;
      })
    )
      throw new MusicError(
        'INVALID_INPUT',
        'Provide a title or public music link up to 4096 characters.',
      );
    const prefix = /^([a-z][a-z0-9+.-]*):/i.exec(query)?.[1]?.toLowerCase();
    if (prefix && !['http', 'https'].includes(prefix) && !platforms.has(prefix))
      throw new MusicError('INVALID_INPUT', 'That URL scheme or search source is not supported.');
    if (platforms.has(prefix ?? '') && !query.slice((prefix?.length ?? 0) + 1).trim())
      throw new MusicError('INVALID_INPUT', 'Provide a search title after the source prefix.');
    return query;
  }
}

/** Strip arbitrary provider query parameters before a URL reaches the remote Lavalink machine. */
export function canonicalProviderUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
      host,
    )
  ) {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : (url.searchParams.get('v') ??
          /^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1]);
    const list = url.searchParams.get('list');
    if ((id && !/^[A-Za-z0-9_-]{11}$/.test(id)) || (list && !/^[A-Za-z0-9_-]{10,200}$/.test(list)))
      throw invalidLink();
    if (id) return `https://www.youtube.com/watch?v=${id}${list ? `&list=${list}` : ''}`;
    if (list && url.pathname === '/playlist')
      return `https://www.youtube.com/playlist?list=${list}`;
    throw invalidLink();
  }
  if (
    host === 'open.spotify.com' &&
    /^\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)
  )
    return `https://${host}${url.pathname}`;
  if (
    ['deezer.com', 'www.deezer.com'].includes(host) &&
    /^\/(?:[a-z]{2}\/)?(?:track|album|playlist|artist)\/\d+\/?$/.test(url.pathname)
  )
    return `https://www.deezer.com${url.pathname}`;
  if (
    host === 'music.apple.com' &&
    /^\/[a-z]{2}\/(?:album|playlist|artist|song)\/[A-Za-z0-9%._~-]+\/[A-Za-z0-9.-]+\/?$/.test(
      url.pathname,
    )
  ) {
    const id = url.searchParams.get('i');
    return `https://${host}${url.pathname}${id && /^\d+$/.test(id) ? `?i=${id}` : ''}`;
  }
  if (
    /^music\.yandex\.(?:ru|com|by|kz)$/.test(host) &&
    /^\/(?:album\/\d+(?:\/track\/\d+)?|artist\/\d+(?:\/tracks)?|users\/[A-Za-z0-9._-]+\/playlists\/\d+|track\/\d+)\/?$/.test(
      url.pathname,
    )
  )
    return `https://${host}${url.pathname}`;
  if (
    ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(host) &&
    /^\/[A-Za-z0-9_-]+\/(?:sets\/)?[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return `https://soundcloud.com${url.pathname}`;
  if (
    ['twitch.tv', 'www.twitch.tv'].includes(host) &&
    /^\/(?:videos\/\d+|[A-Za-z0-9_]+)\/?$/.test(url.pathname)
  )
    return `https://www.twitch.tv${url.pathname}`;
  if (
    /^(?:[a-z0-9-]+\.)?bandcamp\.com$/.test(host) &&
    /^\/(?:track|album)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
    return `https://${host}${url.pathname}`;
  if (['vimeo.com', 'www.vimeo.com'].includes(host) && /^\/\d+\/?$/.test(url.pathname))
    return `https://vimeo.com${url.pathname}`;
  return null;
}
function invalidLink(): MusicError {
  return new MusicError(
    'INVALID_INPUT',
    'Use a complete music track, artist, album, or playlist link.',
  );
}
function unavailable(): MusicError {
  return new MusicError('UNAVAILABLE', 'No full-length match is available for this track.');
}
function decodeFilename(pathname: string): string {
  try {
    return decodeURIComponent(pathname.split('/').at(-1) ?? 'Audio file');
  } catch {
    return 'Audio file';
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/music/ImportScheduler.ts

````typescript
import type { PendingImport } from '../db/models.js';
import type { CatalogPage, ResolvedItem } from './types.js';
import type { SourceResolver } from './SourceResolver.js';
import { Semaphore } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';

export interface ImportHooks {
  /** Atomic append + checkpoint. Return false when the job is cancelled or the queue is full. */
  append(
    jobId: string,
    items: readonly ResolvedItem[],
    processedCount: number,
    name: string,
    total: number | null,
  ): Promise<boolean>;
  complete(jobId: string, failed: boolean, failure?: MusicError): Promise<void>;
}

/** Bounded metadata workers; mirrored audio is prefetched separately for the next five tracks. */
export class ImportScheduler {
  private readonly workers: Semaphore;
  private readonly jobs = new Map<
    string,
    { controller: AbortController; promise: Promise<void> }
  >();
  constructor(
    private readonly resolver: SourceResolver,
    concurrency = 3,
  ) {
    this.workers = new Semaphore(concurrency);
  }
  start(job: PendingImport, hooks: ImportHooks, onFailure: (failure?: MusicError) => void): void {
    if (this.jobs.has(job.id)) return;
    const controller = new AbortController();
    const promise = this.workers
      .run(async () => {
        let processed = 0;
        try {
          for await (const page of this.resolver.pages(job.query, job.limit, controller.signal)) {
            const skip = Math.max(0, job.processedCount - processed);
            processed += page.items.length;
            const items = page.items.slice(skip);
            if (!items.length) continue;
            controller.signal.throwIfAborted();
            if (!(await hooks.append(job.id, items, processed, page.name, page.total))) {
              await hooks.complete(job.id, false);
              return;
            }
          }
          await hooks.complete(job.id, false);
        } catch (error) {
          if (!controller.signal.aborted) {
            const failure = error instanceof MusicError ? error : undefined;
            onFailure(failure);
            await hooks.complete(job.id, true, failure);
          }
        }
      }, controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) onFailure();
      })
      .finally(() => this.jobs.delete(job.id));
    this.jobs.set(job.id, { controller, promise });
  }
  cancel(id: string): void {
    this.jobs.get(id)?.controller.abort();
  }
  async close(): Promise<void> {
    const jobs = [...this.jobs.values()];
    for (const job of jobs) job.controller.abort();
    await Promise.allSettled(jobs.map((job) => job.promise));
  }
}

/** Convenience for personal-playlist import commands; no playback or previews are required. */
export async function collectCatalog(
  pages: AsyncIterable<CatalogPage>,
  maximum: number,
): Promise<ResolvedItem[]> {
  const items: ResolvedItem[] = [];
  for await (const page of pages) {
    items.push(...page.items.slice(0, maximum - items.length));
    if (items.length >= maximum) break;
  }
  return items;
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/EnvFile.ts

````typescript
import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** OAuth helpers change only their own keys, using an atomic private replacement. */
export async function saveOAuthEnv(values: Readonly<Record<string, string>>): Promise<void> {
  const allowed = new Set([
    'YOUTUBE_OAUTH_ENABLED',
    'YOUTUBE_OAUTH_SKIP_INITIALIZATION',
    'YOUTUBE_OAUTH_REFRESH_TOKEN',
    'SPOTIFY_ENABLED',
    'SPOTIFY_REFRESH_TOKEN',
  ]);
  let file: string;
  try {
    file = await readFile('.env', 'utf8');
  } catch {
    throw new Error('Create .env from .env.example before configuring source authorization.');
  }
  const newline = file.includes('\r\n') ? '\r\n' : '\n';
  let lines = file.split(/\r?\n/);
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || /[\r\n\0]/.test(value))
      throw new Error('Unsupported authorization setting.');
    const pattern = new RegExp(`^\\s*${key}\\s*=`);
    let replaced = false;
    lines = lines.flatMap((line) => {
      if (!pattern.test(line)) return [line];
      if (replaced) return [];
      replaced = true;
      return [`${key}=${JSON.stringify(value)}`];
    });
    if (!replaced) {
      if (lines.at(-1) === '') lines.pop();
      lines.push(`${key}=${JSON.stringify(value)}`, '');
    }
  }
  const destination = resolve('.env');
  const temporary = `${destination}.oauth-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, lines.join(newline), { mode: 0o600, flag: 'wx' });
    await rename(temporary, destination);
  } catch {
    throw new Error('Authorization could not be saved. Check that .env is writable.');
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/src/lib/utils/errors.ts

````typescript
export type MusicErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'SPOTIFY_AUTH_REQUIRED'
  | 'SPOTIFY_ACCESS_DENIED'
  | 'NO_PLAYER'
  | 'QUEUE_FULL'
  | 'NOT_SEEKABLE'
  | 'UNSAFE_URL'
  | 'MEDIA_TOO_LARGE'
  | 'NODE_UNAVAILABLE'
  | 'CONFLICT';

/** Only these deliberately authored messages may be shown to Discord users. */
export class MusicError extends Error {
  constructor(
    public readonly code: MusicErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MusicError';
  }
}

export function friendlyError(error: unknown): string {
  return error instanceof MusicError
    ? error.message
    : 'Something went wrong. Please try again in a moment.';
}

export function errorCode(error: unknown): string {
  return error instanceof MusicError ? error.code : 'INTERNAL';
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/package.json

````json
{
  "name": "discord-music-stream",
  "version": "0.1.0",
  "private": true,
  "description": "A self-hosted Discord music bot with validated full-track mirroring and Lavalink v4.",
  "type": "module",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "start": "node --enable-source-maps dist/index.js",
    "start:sharded": "node --enable-source-maps dist/shard.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm test && npm run build",
    "config:check": "tsx scripts/check-env.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "commands:register": "tsx scripts/register-commands.ts",
    "youtube:auth": "tsx scripts/youtube-auth.ts",
    "spotify:auth": "tsx scripts/spotify-auth.ts"
  },
  "dependencies": {
    "better-sqlite3": "12.11.1",
    "discord.js": "14.27.0",
    "dotenv": "18.0.7",
    "drizzle-orm": "0.45.4",
    "ioredis": "6.0.0",
    "ipaddr.js": "2.5.0",
    "lavalink-client": "2.11.0",
    "pino": "10.4.0",
    "zod": "4.6.6"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/better-sqlite3": "9.6.0",
    "@types/node": "20.19.43",
    "drizzle-kit": "0.31.11",
    "eslint": "10.12.0",
    "globals": "17.13.0",
    "pino-pretty": "13.2.0",
    "prettier": "3.9.10",
    "tsup": "8.5.1",
    "tsx": "4.23.15",
    "typescript": "5.9.3",
    "typescript-eslint": "8.71.1",
    "vite": "7.3.7",
    "vitest": "4.1.11",
    "yaml": "2.9.1"
  },
  "overrides": {
    "esbuild": "0.28.2",
    "tinypool": "2.1.2"
  }
}
````

## C:/Users/USER/OneDrive/Documents/ChatGPT/discord-music-stream/docs/phase-6-runtime.md

````markdown
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
````

