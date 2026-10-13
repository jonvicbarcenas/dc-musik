import { makeControl } from '../common.js';
import { arg } from '../../framework/Command.js';
const command = makeControl(
  'seek',
  'Seek to a position in the current track',
  'Position updated.',
  async (context) => {
    await context.services.players.seek(context.guildId, context.args.number('time'));
  },
  { arguments: [arg.duration()] },
);
export const { slash, aliases, execute } = command;
export default command;
