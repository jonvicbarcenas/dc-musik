import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { CommandError } from '../../framework/errors.js';
import { mapPage } from '../common.js';

async function blacklistPage(
  context: CommandContext,
  kind: 'user' | 'guild' | null,
  includeExpired: boolean,
  page: number,
): Promise<CommandView> {
  await context.recheck({ owner: true });
  const result = await context.services.repositories.blacklist.list(
    { ...(kind ? { kind } : {}), includeExpired },
    { page, pageSize: 10 },
  );
  return {
    kind: 'list',
    title: 'Bot blacklist',
    page: mapPage(
      result,
      (entry) => `${entry.kind}: ${entry.targetId} · ${context.safeName(entry.reason)}`,
    ),
    onPage: (fresh, next) => blacklistPage(fresh, kind, includeExpired, next),
  };
}
const command = defineCommand({
  name: 'blacklist',
  description: 'Bot owner: manage blocked users and servers',
  category: 'admin',
  ephemeral: true,
  policy: { owner: true },
  prefixDefault: 'list',
  subcommands: [
    {
      name: 'add',
      description: 'Block a user or server',
      arguments: [
        arg.choice('kind', 'Target kind', ['user', 'guild']),
        arg.text('target', 'User or server ID', true, false, 20),
        arg.text('reason', 'Reason for the owner audit record', false, true, 500),
      ],
    },
    {
      name: 'remove',
      description: 'Unblock a user or server',
      arguments: [
        arg.choice('kind', 'Target kind', ['user', 'guild']),
        arg.text('target', 'User or server ID', true, false, 20),
      ],
    },
    {
      name: 'list',
      description: 'Browse blocked users and servers',
      arguments: [
        arg.choice('kind', 'Target kind', ['all', 'user', 'guild'], false),
        arg.integer('page', 'Page number', false, 1, 1000000),
        arg.boolean('expired', 'Include expired records', false),
      ],
    },
  ],
  execute: async (context) => {
    const kind = context.args.text('kind', 'all');
    if (context.args.subcommand === 'list') {
      await context.present(
        await blacklistPage(
          context,
          kind === 'user' || kind === 'guild' ? kind : null,
          context.args.boolean('expired', false),
          context.args.number('page', 1),
        ),
      );
      return;
    }
    const target = context.args.text('target');
    if (!/^\d{17,20}$/.test(target) || (kind !== 'user' && kind !== 'guild'))
      throw new CommandError('ARGUMENT', 'Provide a valid user or server ID.');
    if (context.args.subcommand === 'remove') {
      const removed = await context.services.repositories.blacklist.remove(kind, target);
      await context.notice(removed ? 'Blacklist entry removed.' : 'That target was not blocked.');
      return;
    }
    await context.services.repositories.blacklist.set({
      kind,
      targetId: target,
      actorId: context.user.id,
      reason: context.args.text('reason', 'Blocked by the bot owner'),
      expiresAt: null,
    });
    await context.notice('Blacklist entry saved.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
