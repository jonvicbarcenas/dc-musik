import { arg, defineCommand } from '../../framework/Command.js';
import { queueView, readPolicy } from '../common.js';
const command = defineCommand({
  name: 'queue',
  description: 'Browse the upcoming queue',
  category: 'queue',
  aliases: ['q'],
  policy: readPolicy,
  arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
  execute: async (context) => {
    await context.present(await queueView(context, context.args.number('page', 1)));
  },
});
export const { slash, aliases, execute } = command;
export default command;
