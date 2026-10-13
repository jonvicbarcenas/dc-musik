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
