import { defineCommand } from '../../framework/Command.js';
import { formatTime } from '../../lib/utils/time.js';
import { readPolicy } from '../common.js';
const command = defineCommand({
  name: 'grab',
  description: 'Send the current song details to your DMs',
  category: 'extras',
  aliases: ['save'],
  policy: readPolicy,
  execute: async (context) => {
    const current = context.current();
    const link = current.track.uri ?? current.playable?.uri;
    const publicLink = current.track.localFileId ? null : link && link.length <= 1000 ? link : null;
    await context.dm(
      context.safeName(current.track.title) +
        ' — ' +
        context.safeName(current.track.artist) +
        '\n' +
        (current.track.isStream ? 'Live stream' : formatTime(current.track.durationMs)) +
        (publicLink
          ? '\n<' + publicLink + '>'
          : '\nUploaded audio; save it to favorites to queue it again.'),
    );
    await context.notice('I sent the current song to your DMs.');
  },
});
export const { slash, aliases, execute } = command;
export default command;
