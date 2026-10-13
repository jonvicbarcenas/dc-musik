import { arg, categories, defineCommand } from '../../framework/Command.js';
import { PermissionFlagsBits } from 'discord.js';
const command = defineCommand({
  name: 'help',
  description: 'Browse commands by category',
  category: 'extras',
  arguments: [arg.choice('category', 'Command category', categories, false)],
  execute: async (context) => {
    const requested = context.args.text('category', 'playback');
    const selected = categories.find((category) => category === requested) ?? 'playback';
    const owner = context.services.env.OWNER_IDS.includes(context.user.id);
    const admin = owner || context.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const entries = context.services.registry
      .all()
      .filter((entry) => {
        if (entry.category === 'admin' && !admin) return false;
        return typeof entry.policy === 'function' || !entry.policy.owner || owner;
      })
      .map((entry) => ({
        category: entry.category,
        name: entry.name,
        description: entry.description,
        usage:
          context.settings.prefix +
          entry.name +
          (entry.subcommands?.length
            ? ' <subcommand>'
            : (entry.arguments ?? [])
                .map((spec) => (spec.required ? ` <${spec.name}>` : ` [${spec.name}]`))
                .join('')),
      }));
    await context.present({ kind: 'help', selected, entries });
  },
});
export const { slash, aliases, execute } = command;
export default command;
