import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'autoleave',
  'View or change idle/empty voice leave timeout',
  'autoLeaveTimeoutSeconds',
  arg.integer('seconds', 'Idle leave timeout in seconds', false, 10, 86400),
  (context) => ({ autoLeaveTimeoutSeconds: context.args.number('seconds') }),
);
export const { slash, aliases, execute } = command;
export default command;
