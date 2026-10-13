import { makeControl } from '../common.js';
import { arg } from '../../framework/Command.js';
const command = makeControl(
  'forward',
  'Move forward by a number of seconds',
  'Moved forward.',
  async (context) => {
    await context.services.players.seekRelative(
      context.guildId,
      Math.round(context.args.number('seconds') * 1000),
    );
  },
  { arguments: [arg.number('seconds', 'Seconds to move forward', 0.1, 86400)] },
);
export const { slash, aliases, execute } = command;
export default command;
