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
    const lyrics = await context.services.lyrics.get(
      context.guildId,
      current.track,
      current.playable,
    );
    if (!lyrics) throw new CommandError('ARGUMENT', 'Lyrics are unavailable for this track.');
    await context.present({ kind: 'lyrics', track: current.track, lyrics });
  },
});
export const { slash, aliases, execute } = command;
export default command;
