import { makeControl } from '../common.js';
const command = makeControl('pause', 'Pause the current track', 'Paused.', async (context) => {
  await context.services.players.pause(
    context.guildId,
    true,
    context.expectedPlaybackId ?? undefined,
  );
});
export const { slash, aliases, execute } = command;
export default command;
