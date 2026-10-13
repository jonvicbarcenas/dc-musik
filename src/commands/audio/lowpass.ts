import { makePreset } from '../common.js';
const command = makePreset('lowpass', 'Apply or disable high-frequency smoothing', 'lowpass');
export const { slash, aliases, execute } = command;
export default command;
