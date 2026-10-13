import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { CommandError } from '../../framework/errors.js';
import { joinPolicy, mapPage, selectedTrack } from '../common.js';

export async function favoritesPage(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck({});
  const result = await context.services.repositories.userFavorites.list(context.user.id, {
    page,
    pageSize: 10,
  });
  return {
    kind: 'tracks',
    title: 'Your favorites',
    page: mapPage(result, (favorite) => favorite.track),
    onPage: favoritesPage,
  };
}
const command = defineCommand({
  name: 'favorites',
  description: 'Manage and play your personal favorites',
  category: 'extras',
  aliases: ['favorite', 'fav'],
  ephemeral: true,
  prefixDefault: 'list',
  policy: (args) => (args.subcommand === 'play' ? joinPolicy : {}),
  subcommands: [
    {
      name: 'add',
      description: 'Save the current song or an upcoming position',
      arguments: [arg.integer('position', 'Upcoming position; omit for current song', false)],
    },
    {
      name: 'remove',
      description: 'Remove a favorite by list position or key',
      arguments: [arg.text('target', 'Favorite list position or catalog key')],
    },
    {
      name: 'list',
      description: 'Browse your favorites',
      arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
    },
    {
      name: 'play',
      description: 'Play all favorites or one list position',
      arguments: [arg.integer('position', 'Favorite list position; omit to play all', false)],
    },
  ],
  execute: async (context) => {
    const repository = context.services.repositories.userFavorites;
    switch (context.args.subcommand) {
      case 'add': {
        const track = selectedTrack(
          context,
          context.args.has('position') ? context.args.number('position') : undefined,
        );
        await repository.add(context.user.id, track);
        await context.present({ kind: 'track', title: 'Saved to your favorites', track });
        return;
      }
      case 'remove': {
        const target = context.args.text('target');
        let key = target;
        if (/^\d+$/.test(target)) {
          const track = (await repository.all(context.user.id))[Number(target) - 1];
          if (!track) throw new CommandError('ARGUMENT', 'That favorite position does not exist.');
          key = track.key;
        }
        if (!(await repository.remove(context.user.id, key)))
          throw new CommandError('ARGUMENT', 'That favorite was not found.');
        await context.notice('Favorite removed.');
        return;
      }
      case 'play': {
        const all = await repository.all(context.user.id);
        const tracks = context.args.has('position')
          ? all.slice(context.args.number('position') - 1, context.args.number('position'))
          : all;
        if (!tracks.length)
          throw new CommandError(
            'ARGUMENT',
            'There are no favorites at that position. Save a song first.',
          );
        await context.joinPlayer();
        await context.services.players.enqueue(
          context.guildId,
          tracks.map((track) => ({ track, playable: null })),
          context.requester,
        );
        await context.present({
          kind: 'added',
          tracks: tracks.slice(0, 5),
          count: tracks.length,
          total: tracks.length,
          name: 'Favorites',
          background: false,
          mode: 'append',
        });
        return;
      }
      default:
        await context.present(await favoritesPage(context, context.args.number('page', 1)));
    }
  },
});
export const { slash, aliases, execute } = command;
export default command;
