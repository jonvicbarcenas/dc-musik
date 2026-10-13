import { makePlay } from '../common.js';
const command = makePlay('playnext', 'Queue music immediately after the current track', 'next');
export const { slash, aliases, execute } = command;
export default command;
