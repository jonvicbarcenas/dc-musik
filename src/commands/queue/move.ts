import { arg, defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'move',
  description: 'Move the bot to your voice channel, or reorder two queue positions',
  category: 'queue',
  policy: (args) =>
    args.has('from') || args.has('to')
      ? controlPolicy
      : { voice: 'move', dj: true, musicChannel: true },
  arguments: [
    arg.integer('from', 'Upcoming position to move', false),
    arg.integer('to', 'New upcoming position', false),
  ],
  execute: async (context) => {
    if (!context.args.has('from') && !context.args.has('to')) {
      await context.movePlayer();
      await context.notice('Moved to your voice channel.');
      return;
    }
    if (!context.args.has('from') || !context.args.has('to'))
      throw new CommandError(
        'ARGUMENT',
        'Provide both from and to positions, or neither to move the bot.',
      );
    await context.services.players.mutateQueue(context.guildId, (queue) =>
      queue.move(context.args.number('from'), context.args.number('to')),
    );
    await context.notice('Queue position moved.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
