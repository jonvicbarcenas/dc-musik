import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'defaultvolume',
  'View or change the volume for future players',
  'defaultVolume',
  arg.integer('percent', 'Default volume percent', false, 1, 200),
  (context) => ({ defaultVolume: context.args.number('percent') }),
);
export const { slash, aliases, execute } = command;
export default command;
