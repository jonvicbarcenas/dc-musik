import { arg, defineCommand } from '../../framework/Command.js';
import { skipPolicy } from '../common.js';
const command = defineCommand({
  name: 'skipto',
  description: 'Jump to a one-based upcoming queue position',
  category: 'playback',
  aliases: ['jump'],
  policy: skipPolicy,
  arguments: [arg.integer('position', 'Upcoming queue position')],
  execute: async (context) => {
    await context.services.votes.skip(context, context.args.number('position'));
  },
});
export const { slash, aliases, execute } = command;
export default command;
