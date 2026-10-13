import { makePreset } from '../common.js';
const command = makePreset('bassboost', 'Apply or disable the bass equalizer preset', 'bassboost');
export const { slash, aliases, execute } = command;
export default command;
