import { arg, defineCommand } from '../../framework/Command.js';
import { equalizer, equalizerPresets } from '../../lib/music/FilterPresets.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'equalizer',
  description: 'Apply an equalizer preset',
  category: 'audio',
  aliases: ['eq'],
  policy: controlPolicy,
  arguments: [arg.choice('preset', 'Equalizer preset', Object.keys(equalizerPresets))],
  execute: async (context) => {
    const name = context.args.text('preset');
    if (!Object.hasOwn(equalizerPresets, name)) return;
    await context.services.players.filters(context.guildId, {
      ...context.requireSnapshot().filters,
      equalizer: equalizer(name as keyof typeof equalizerPresets),
    });
    await context.notice(`Equalizer: ${name}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
