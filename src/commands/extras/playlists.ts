import { arg, defineCommand } from '../../framework/Command.js';
import type { CommandContext } from '../../framework/CommandContext.js';
import type { CommandView } from '../../framework/CommandUI.js';
import { CommandError } from '../../framework/errors.js';
import { shareTokenSchema } from '../../lib/db/models.js';
import type { PersonalPlaylist, StoredTrack } from '../../lib/db/models.js';
import { collectCatalog } from '../../lib/music/ImportScheduler.js';
import { parsePositions } from '../../lib/utils/positions.js';
import { joinPolicy, mapPage } from '../common.js';

const playlistArg = () =>
  arg.text('playlist', 'Playlist name, ID, or read-only share token', true, false, 64);
async function owned(context: CommandContext, name: string): Promise<PersonalPlaylist> {
  const playlist = await context.services.repositories.playlists.findOwned(context.user.id, name);
  if (!playlist)
    throw new CommandError('ARGUMENT', 'That playlist was not found or does not belong to you.');
  return playlist;
}
export async function playlistsPage(context: CommandContext, page: number): Promise<CommandView> {
  await context.recheck({});
  const result = await context.services.repositories.playlists.list(context.user.id, {
    page,
    pageSize: 10,
  });
  return {
    kind: 'list',
    title: 'Your playlists',
    page: mapPage(
      result,
      (playlist) => `${context.safeName(playlist.name)}${playlist.isShared ? ' · Shared' : ''}`,
    ),
    onPage: playlistsPage,
  };
}
async function playlistPage(
  context: CommandContext,
  name: string,
  page: number,
): Promise<CommandView> {
  await context.recheck({});
  const repository = context.services.repositories.playlists;
  const playlist = await repository.findOwned(context.user.id, name);
  const result = playlist
    ? await repository.viewOwned(context.user.id, playlist.id, { page, pageSize: 10 })
    : shareTokenSchema.safeParse(name).success
      ? await repository.viewShared(name, { page, pageSize: 10 })
      : null;
  if (!result)
    throw new CommandError(
      'ARGUMENT',
      'Playlist not found. Use its quoted name, ID, or share token.',
    );
  return {
    kind: 'tracks',
    title: result.playlist.name,
    page: mapPage(result.tracks, (entry) => entry.track),
    onPage: (fresh, next) => playlistPage(fresh, name, next),
  };
}
async function tracksForPlayback(context: CommandContext, name: string): Promise<StoredTrack[]> {
  const repository = context.services.repositories.playlists;
  const playlist = await repository.findOwned(context.user.id, name);
  if (playlist) return repository.tracksOwned(context.user.id, playlist.id);
  if (shareTokenSchema.safeParse(name).success) return repository.tracksShared(name);
  throw new CommandError(
    'ARGUMENT',
    'Playlist not found. Use its quoted name, ID, or share token.',
  );
}

const command = defineCommand({
  name: 'playlists',
  description: 'Create, edit, import, play, and share personal playlists',
  category: 'extras',
  aliases: ['playlist', 'pl'],
  ephemeral: true,
  prefixDefault: 'list',
  policy: (args) => (args.subcommand === 'play' ? joinPolicy : {}),
  subcommands: [
    {
      name: 'create',
      description: 'Create a private playlist',
      arguments: [arg.text('name', 'Playlist name', true, true, 64)],
    },
    { name: 'delete', description: 'Delete your playlist', arguments: [playlistArg()] },
    {
      name: 'add',
      description: 'Add the current track, queue:N, or a song/link',
      arguments: [
        playlistArg(),
        arg.text('query', 'Current, queue:N, or song/link; omit for current', false, true),
      ],
    },
    {
      name: 'remove',
      description: 'Remove playlist positions or ranges',
      arguments: [
        playlistArg(),
        arg.text('positions', 'Positions such as 2 or 3-5', true, true, 1000),
      ],
    },
    {
      name: 'view',
      description: 'Browse an owned or shared playlist',
      arguments: [playlistArg(), arg.integer('page', 'Page number', false, 1, 1000000)],
    },
    {
      name: 'list',
      description: 'Browse your playlist names',
      arguments: [arg.integer('page', 'Page number', false, 1, 1000000)],
    },
    {
      name: 'play',
      description: 'Queue an owned playlist or read-only share token',
      arguments: [playlistArg()],
    },
    {
      name: 'import',
      description: 'Append metadata from a Spotify or YouTube collection',
      arguments: [playlistArg(), arg.text('query', 'Public Spotify or YouTube link', true, true)],
    },
    {
      name: 'share',
      description: 'Create a private read token or revoke sharing',
      arguments: [
        playlistArg(),
        arg.boolean('enabled', 'Enable or revoke read-only sharing', false),
      ],
    },
  ],
  execute: async (context) => {
    const repository = context.services.repositories.playlists;
    switch (context.args.subcommand) {
      case 'create': {
        const playlist = await repository.create(context.user.id, context.args.text('name'));
        await context.notice(`Created ${context.safeName(playlist.name)}.`);
        return;
      }
      case 'delete': {
        const playlist = await owned(context, context.args.text('playlist'));
        await repository.delete(context.user.id, playlist.id);
        await context.notice(`Deleted ${context.safeName(playlist.name)}.`);
        return;
      }
      case 'add': {
        const playlist = await owned(context, context.args.text('playlist'));
        const query = context.args.text('query', 'current');
        let track: StoredTrack | null = null;
        if (query.toLowerCase() === 'current') track = context.current().track;
        else if (/^queue:\d+$/i.test(query)) {
          const position = Number(query.split(':')[1]);
          track = context.requireSnapshot().upcoming[position - 1]?.track ?? null;
        } else {
          await context.services.catalogWork.run(async () => {
            for await (const page of context.services.players.resolver.pages(
              query,
              1,
              context.signal,
            )) {
              track = page.items[0]?.track ?? null;
              break;
            }
          }, context.signal);
        }
        if (!track)
          throw new CommandError('ARGUMENT', 'That song or queue position was not found.');
        const total = await repository.append(context.user.id, playlist.id, [track]);
        await context.notice(
          `Added one track to ${context.safeName(playlist.name)} (${total} total).`,
        );
        return;
      }
      case 'remove': {
        const playlist = await owned(context, context.args.text('playlist'));
        const tracks = await repository.tracksOwned(context.user.id, playlist.id);
        const removed = await repository.remove(
          context.user.id,
          playlist.id,
          parsePositions(context.args.text('positions'), tracks.length),
        );
        await context.notice(`Removed ${removed} playlist track(s).`);
        return;
      }
      case 'play': {
        const tracks = await tracksForPlayback(context, context.args.text('playlist'));
        if (!tracks.length)
          throw new CommandError('ARGUMENT', 'This playlist is empty. Add or import songs first.');
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
          name: 'Personal playlist',
          background: false,
          mode: 'append',
        });
        return;
      }
      case 'import': {
        const playlist = await owned(context, context.args.text('playlist'));
        const query = context.args.text('query');
        let url: URL;
        try {
          url = new URL(query);
        } catch {
          throw new CommandError('ARGUMENT', 'Import a public Spotify or YouTube link.');
        }
        if (
          ![
            'open.spotify.com',
            'youtube.com',
            'www.youtube.com',
            'music.youtube.com',
            'm.youtube.com',
            'youtu.be',
          ].includes(url.hostname)
        )
          throw new CommandError('ARGUMENT', 'Import a public Spotify or YouTube link.');
        const items = await context.services.catalogWork.run(
          () =>
            collectCatalog(
              context.services.players.resolver.pages(
                query,
                context.services.env.MAX_PLAYLIST_IMPORT,
                context.signal,
              ),
              context.services.env.MAX_PLAYLIST_IMPORT,
            ),
          context.signal,
        );
        if (!items.length) throw new CommandError('ARGUMENT', 'No tracks could be imported.');
        const total = await repository.append(
          context.user.id,
          playlist.id,
          items.map((item) => item.track),
        );
        await context.notice(
          `Imported ${items.length} track(s) into ${context.safeName(playlist.name)} (${total} total).`,
        );
        return;
      }
      case 'share': {
        const playlist = await owned(context, context.args.text('playlist'));
        const enabled = context.args.boolean('enabled', true);
        const shared = await repository.setShared(context.user.id, playlist.id, enabled);
        if (!enabled) {
          await context.notice('Sharing disabled. The old token no longer works.');
          return;
        }
        if (!shared.shareToken) throw new Error('Missing share token.');
        await context.privateText(
          `Read-only share token for ${context.safeName(playlist.name)}: \`${shared.shareToken}\`\nUse /playlists view or /playlists play with this token as the playlist. Anyone with the token can read it. Disable sharing to revoke it.`,
        );
        return;
      }
      case 'view':
        await context.present(
          await playlistPage(
            context,
            context.args.text('playlist'),
            context.args.number('page', 1),
          ),
        );
        return;
      default:
        await context.present(await playlistsPage(context, context.args.number('page', 1)));
    }
  },
});
export const { slash, aliases, execute } = command;
export default command;
