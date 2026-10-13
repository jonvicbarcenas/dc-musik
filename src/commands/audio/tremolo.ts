import { makePreset } from '../common.js';
const command = makePreset('tremolo', 'Apply or disable a volume oscillation effect', 'tremolo');
export const { slash, aliases, execute } = command;
export default command;
