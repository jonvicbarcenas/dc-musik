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
