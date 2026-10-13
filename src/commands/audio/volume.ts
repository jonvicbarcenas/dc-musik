import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'volume',
  description: 'Set and save playback volume from 1 to 200 percent',
  category: 'audio',
  aliases: ['vol'],
  policy: controlPolicy,
  arguments: [arg.integer('percent', 'Volume percent', true, 1, 200)],
  execute: async (context) => {
    const volume = context.args.number('percent');
    await context.services.players.volume(
      context.guildId,
      volume,
      context.expectedPlaybackId ?? undefined,
    );
    await context.notice(`Volume: ${volume}%.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
