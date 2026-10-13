import { defineCommand } from '../../framework/Command.js';
import { readPolicy } from '../common.js';
const command = defineCommand({
  name: 'nowplaying',
  description: 'Show the current song and player controls',
  category: 'queue',
  aliases: ['np'],
  policy: readPolicy,
  execute: async (context) => {
    context.current();
    await context.present({ kind: 'nowplaying', snapshot: context.requireSnapshot() });
  },
});
export const { slash, aliases, execute } = command;
export default command;
