import { arg, defineCommand } from '../../framework/Command.js';
import { setTimescale } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'pitch',
  description: 'Set playback pitch from 0.25 to 4',
  category: 'audio',
  policy: controlPolicy,
  arguments: [arg.number('value', 'pitch multiplier')],
  execute: async (context) => {
    const value = context.args.number('value');
    await context.services.players.filters(
      context.guildId,
      setTimescale(context.requireSnapshot().filters, 'pitch', value),
    );
    await context.notice('pitch: ' + value + '×.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
