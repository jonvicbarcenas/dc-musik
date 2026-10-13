import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'announce',
  'View or toggle Now Playing announcements',
  'announceNowPlaying',
  arg.boolean('enabled', 'Announce new tracks', false),
  (context) => ({ announceNowPlaying: context.args.boolean('enabled') }),
);
export const { slash, aliases, execute } = command;
export default command;
