import { makeControl } from '../common.js';
import { arg } from '../../framework/Command.js';
const command = makeControl(
  'rewind',
  'Move backward by a number of seconds',
  'Moved backward.',
  async (context) => {
    await context.services.players.seekRelative(
      context.guildId,
      -Math.round(context.args.number('seconds') * 1000),
    );
  },
  { arguments: [arg.number('seconds', 'Seconds to move backward', 0.1, 86400)] },
);
export const { slash, aliases, execute } = command;
export default command;
