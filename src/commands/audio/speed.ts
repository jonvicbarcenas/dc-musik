import { arg, defineCommand } from '../../framework/Command.js';
import { setTimescale } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'speed',
  description: 'Set playback speed from 0.25 to 4',
  category: 'audio',
  policy: controlPolicy,
  arguments: [arg.number('value', 'speed multiplier')],
  execute: async (context) => {
    const value = context.args.number('value');
    await context.services.players.filters(
      context.guildId,
      setTimescale(context.requireSnapshot().filters, 'speed', value),
    );
    await context.notice('speed: ' + value + '×.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
