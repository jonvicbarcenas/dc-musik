import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'maxqueue',
  'View or set the maximum active queue size',
  'maxQueueSize',
  arg.integer('count', 'Maximum tracks including the current track', false, 1, 10000),
  (context) => ({ maxQueueSize: context.args.number('count') }),
);
export const { slash, aliases, execute } = command;
export default command;
