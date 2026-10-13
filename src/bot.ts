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
