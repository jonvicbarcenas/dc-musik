import { makePreset } from '../common.js';
const command = makePreset('8d', 'Apply or disable rotating stereo audio', '8d', ['eightd']);
export const { slash, aliases, execute } = command;
export default command;
