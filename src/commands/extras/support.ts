import { defineCommand } from '../../framework/Command.js';
const command = defineCommand({
  name: 'support',
  description: 'Get the configured support link',
  category: 'extras',
  execute: async (context) => {
    await context.notice(
      context.services.env.SUPPORT_URL
        ? '[Get support](' + context.services.env.SUPPORT_URL + ')'
        : 'No support link is configured. Ask this server’s bot owner for help.',
      'Support',
      'info',
    );
  },
});
export const { slash, aliases, execute } = command;
export default command;
