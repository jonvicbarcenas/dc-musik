import { makePreset } from '../common.js';
const command = makePreset(
  'nightcore',
  'Apply or disable faster playback with higher pitch',
  'nightcore',
);
export const { slash, aliases, execute } = command;
export default command;
