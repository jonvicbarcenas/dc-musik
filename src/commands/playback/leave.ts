import { makeControl } from '../common.js';
const command = makeControl(
  'leave',
  'Disconnect and discard this server’s active or saved queue',
  'Disconnected.',
  async (context) => {
    await context.disconnect();
  },
  { aliases: ['disconnect', 'dc'], policy: { voice: 'same', dj: true, musicChannel: true } },
);
export const { slash, aliases, execute } = command;
export default command;
