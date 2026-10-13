import { makeControl, joinPolicy } from '../common.js';
const command = makeControl(
  'join',
  'Join your voice or stage channel',
  'Joined your voice channel.',
  async (context) => {
    await context.joinPlayer();
  },
  { policy: joinPolicy },
);
export const { slash, aliases, execute } = command;
export default command;
