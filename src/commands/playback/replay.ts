import { makeControl } from '../common.js';
const command = makeControl(
  'replay',
  'Restart the current track from the beginning',
  'Restarting the current track.',
  async (context) => {
    await context.services.players.replay(context.guildId);
  },
);
export const { slash, aliases, execute } = command;
export default command;
