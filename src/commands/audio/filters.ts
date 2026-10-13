import { defineCommand } from '../../framework/Command.js';
import { controlPolicy, readPolicy } from '../common.js';
const command = defineCommand({
  name: 'filters',
  description: 'Inspect or reset all audio filters',
  category: 'audio',
  prefixDefault: 'show',
  policy: (args) => (args.subcommand === 'reset' ? controlPolicy : { ...readPolicy, player: true }),
  subcommands: [
    { name: 'show', description: 'Show active filters' },
    { name: 'reset', description: 'Reset all audio filters' },
  ],
  execute: async (context) => {
    if (context.args.subcommand === 'reset') {
      await context.services.players.filters(context.guildId, {});
      await context.notice('All audio filters reset.');
      return;
    }
    const filters = context.requireSnapshot().filters;
    await context.present({
      kind: 'settings',
      values: {
        speed: (filters.timescale?.speed ?? 1) + '×',
        pitch: (filters.timescale?.pitch ?? 1) + '×',
        rate: (filters.timescale?.rate ?? 1) + '×',
        equalizer:
          filters.equalizer?.map((band) => band.band + ':' + band.gain.toFixed(2)).join(' ') ??
          'Flat',
        effects:
          ['karaoke', 'tremolo', 'vibrato', 'rotation', 'lowPass', 'channelMix']
            .filter((name) => Object.hasOwn(filters, name))
            .join(', ') || 'None',
      },
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;
