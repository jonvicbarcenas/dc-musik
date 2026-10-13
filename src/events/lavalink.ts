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
