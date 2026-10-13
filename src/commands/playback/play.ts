import { makePlay } from '../common.js';
const command = makePlay('play', 'Play a song, link, playlist, or uploaded audio file', 'append', [
  'p',
]);
export const { slash, aliases, execute } = command;
export default command;
