import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'loop',
  description: 'Loop the current track, the queue, or neither',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.choice('mode', 'Loop mode', ['off', 'track', 'queue'])],
  execute: async (context) => {
    const mode = context.args.text('mode');
    if (mode !== 'off' && mode !== 'track' && mode !== 'queue') return;
    await context.services.players.loop(
      context.guildId,
      mode,
      context.expectedPlaybackId ?? undefined,
    );
    await context.notice(`Loop mode: ${mode}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
