import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'prefix',
  'View or change the server command prefix',
  'prefix',
  arg.text('value', 'New command prefix', false, false, 10),
  (context) => ({ prefix: context.args.text('value') }),
);
export const { slash, aliases, execute } = command;
export default command;
