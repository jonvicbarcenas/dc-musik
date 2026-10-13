import { makePreset } from '../common.js';
const command = makePreset(
  'vaporwave',
  'Apply or disable slower playback with lower pitch',
  'vaporwave',
);
export const { slash, aliases, execute } = command;
export default command;
