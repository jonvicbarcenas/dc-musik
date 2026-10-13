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
