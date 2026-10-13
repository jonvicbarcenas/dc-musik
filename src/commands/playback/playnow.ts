import { makePlay } from '../common.js';
const command = makePlay('playnow', 'Replace the current track with your music', 'now', [
  'forceplay',
]);
export const { slash, aliases, execute } = command;
export default command;
