import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'maxtracklength',
  'View or set maximum finite song duration',
  'maxTrackLengthSeconds',
  arg.duration('time', 'Maximum duration, such as 2h', 30000, 86400000),
  (context) => ({ maxTrackLengthSeconds: Math.floor(context.args.number('time') / 1000) }),
);
export const { slash, aliases, execute } = command;
export default command;
