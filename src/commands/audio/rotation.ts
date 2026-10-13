import { makePreset } from '../common.js';
const command = makePreset('rotation', 'Apply or disable stereo rotation', 'rotation');
export const { slash, aliases, execute } = command;
export default command;
