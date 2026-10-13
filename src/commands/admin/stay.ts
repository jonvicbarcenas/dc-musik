import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'stay',
  'View or toggle 24/7 voice mode',
  'stayInVoice',
  arg.boolean('enabled', 'Keep the bot in voice while idle', false),
  (context) => ({ stayInVoice: context.args.boolean('enabled') }),
);
export const { slash, aliases, execute } = command;
export default command;
