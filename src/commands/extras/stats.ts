import { defineCommand } from '../../framework/Command.js';
const command = defineCommand({
  name: 'stats',
  description: 'Show bot uptime, server/player counts, memory, and latency',
  category: 'extras',
  execute: async (context) => {
    const memory = process.memoryUsage();
    const ping = context.services.client.ws.ping;
    await context.present({
      kind: 'stats',
      uptimeMs: Math.floor(process.uptime() * 1000),
      guilds: context.services.client.guilds.cache.size,
      players: context.services.players.size,
      shards: context.services.client.shard?.ids ?? [0],
      rssBytes: memory.rss,
      heapBytes: memory.heapUsed,
      gatewayPingMs: Number.isFinite(ping) && ping >= 0 ? ping : null,
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;
