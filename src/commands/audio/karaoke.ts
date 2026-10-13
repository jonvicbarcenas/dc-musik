import { makePreset } from '../common.js';
const command = makePreset('karaoke', 'Apply or disable vocal reduction', 'karaoke');
export const { slash, aliases, execute } = command;
export default command;
