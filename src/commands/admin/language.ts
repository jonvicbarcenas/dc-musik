import { arg } from '../../framework/Command.js';
import { makeSetting } from '../common.js';
const command = makeSetting(
  'language',
  'View or set the server language',
  'language',
  arg.choice('code', 'Language code', ['en', 'tl'], false),
  (context) => ({ language: context.args.text('code') === 'tl' ? 'tl' : 'en' }),
);
export const { slash, aliases, execute } = command;
export default command;
