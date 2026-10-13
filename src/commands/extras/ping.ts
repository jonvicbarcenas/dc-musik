import { defineCommand } from '../../framework/Command.js';
const command = defineCommand({
  name: 'ping',
  description: 'Show command delivery and gateway latency',
  category: 'extras',
  execute: async (context) => {
    const ping = context.services.client.ws.ping;
    await context.notice(
      'Command delivery: ' +
        Math.max(0, Date.now() - context.createdTimestamp) +
        'ms. Gateway: ' +
        (ping >= 0 && Number.isFinite(ping) ? ping + 'ms.' : 'measuring.'),
      'Pong',
      'info',
    );
  },
});
export const { slash, aliases, execute } = command;
export default command;
