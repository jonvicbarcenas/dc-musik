import { arg, defineCommand } from '../../framework/Command.js';
import { controlPolicy } from '../common.js';
const command = defineCommand({
  name: 'autoplay',
  description: 'Enable or disable related music when the queue ends',
  category: 'queue',
  policy: controlPolicy,
  arguments: [arg.boolean()],
  execute: async (context) => {
    const enabled = context.args.boolean('enabled');
    await context.services.players.setAutoplay(context.guildId, enabled);
    await context.notice(`Autoplay ${enabled ? 'enabled' : 'disabled'}.`);
  },
});
export const { slash, aliases, execute } = command;
export default command;
