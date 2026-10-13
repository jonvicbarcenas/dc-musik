import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { mapPage } from '../common.js';

export async function historyPage(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck({});
  const result = await context.services.repositories.history.list(
    { userId: context.user.id },
    { page, pageSize: 10 },
  );
  return {
    kind: 'tracks',
    title: 'Your recent listening history',
    page: mapPage(result, (entry) => entry.track),
    onPage: historyPage,
  };
}
const command = defineCommand({
  name: 'history',
  description: 'Browse your retained listening history',
  category: 'extras',
  ephemeral: true,
  arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
  execute: async (context) => {
    await context.present(await historyPage(context, context.args.number('page', 1)));
  },
});
export const { slash, aliases, execute } = command;
export default command;
