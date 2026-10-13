import { arg, defineCommand } from '../../framework/Command.js';
import { skipPolicy } from '../common.js';
const command = defineCommand({
  name: 'skip',
  description: 'Skip tracks or vote to skip the current song',
  category: 'playback',
  policy: skipPolicy,
  arguments: [arg.integer('count', 'Number of tracks to skip', false)],
  execute: async (context) => {
    await context.services.votes.skip(context, context.args.number('count', 1));
  },
});
export const { slash, aliases, execute } = command;
export default command;
