import { defineCommand } from '../../framework/Command.js';
import { CommandError } from '../../framework/errors.js';
import { readPolicy } from '../common.js';
const command = defineCommand({
  name: 'lyrics',
  description: 'Show lyrics for the current song, synced when available',
  category: 'extras',
  policy: readPolicy,
  execute: async (context) => {
    const current = context.current();
    const playbackId = context.snapshot?.currentPlaybackId;
    const lyrics = await context.services.lyrics.get(
      context.guildId,
      current.track,
      current.playable,
    );
    if (context.services.players.view(context.guildId)?.currentPlaybackId !== playbackId)
      throw new CommandError('ARGUMENT', 'The track changed. Run lyrics again.');
    if (!lyrics) throw new CommandError('ARGUMENT', 'Lyrics are unavailable for this track.');
    await context.present({ kind: 'lyrics', track: current.track, lyrics });
  },
});
export const { slash, aliases, execute } = command;
export default command;
