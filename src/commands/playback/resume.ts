import { makeControl } from '../common.js';
const command = makeControl('resume', 'Resume the paused track', 'Resumed.', async (context) => {
  await context.services.players.pause(
    context.guildId,
    false,
    context.expectedPlaybackId ?? undefined,
  );
});
export const { slash, aliases, execute } = command;
export default command;
