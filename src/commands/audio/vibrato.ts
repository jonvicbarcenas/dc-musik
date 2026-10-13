import { makePreset } from '../common.js';
const command = makePreset('vibrato', 'Apply or disable a pitch oscillation effect', 'vibrato');
export const { slash, aliases, execute } = command;
export default command;
