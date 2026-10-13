import { arg, defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { joinPolicy } from '../common.js';
const command = defineCommand({
  name: 'search',
  description: 'Choose from the top ten search results',
  category: 'playback',
  policy: joinPolicy,
  arguments: [arg.text('query', 'Song title, artist, or source-prefixed search', true, true)],
  execute: async (context) => {
    const items = await context.services.players.resolver.search(context.args.text('query'));
    if (!items.length)
      throw new CommandError('ARGUMENT', 'No full tracks were found. Try another title.');
    await context.present({
      kind: 'search',
      items,
      onSelect: async (selection, index) => {
        if (selection.user.id !== context.user.id)
          throw new CommandError('PERMISSION', 'Only the person who searched may choose a result.');
        if (!Number.isInteger(index) || !items[index])
          throw new CommandError('ARGUMENT', 'Choose a valid search result.');
        await selection.joinPlayer();
        const item = items[index];
        if (!item) return;
        await selection.services.players.enqueue(selection.guildId, [item], selection.requester);
        await selection.present({
          kind: 'added',
          tracks: [item.track],
          count: 1,
          total: 1,
          name: item.track.title,
          background: false,
          mode: 'append',
        });
      },
    });
  },
});
export const { slash, aliases, execute } = command;
export default command;
