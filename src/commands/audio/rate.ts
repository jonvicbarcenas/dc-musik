import { arg, defineCommand } from '../../framework/Command.js';
import { setTimescale } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'rate',
  description: 'Set playback rate from 0.25 to 4',
  category: 'audio',
  policy: controlPolicy,
  arguments: [arg.number('value', 'rate multiplier')],
  execute: async (context) => {
    const value = context.args.number('value');
    await context.services.players.filters(
      context.guildId,
      setTimescale(context.requireSnapshot().filters, 'rate', value),
    );
    await context.notice('rate: ' + value + '×.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
