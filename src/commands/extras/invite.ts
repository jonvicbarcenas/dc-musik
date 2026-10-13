import { OAuth2Scopes } from 'discord.js';
import { defineCommand } from '../../framework/Command.js';
import { invitePermissions } from '../../lib/utils/permissions.js';
const command = defineCommand({
  name: 'invite',
  description: 'Get the bot invite with music and slash-command permissions',
  category: 'extras',
  execute: async (context) => {
    const link = context.services.client.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: invitePermissions,
    });
    await context.notice('[Invite this bot](' + link + ')', 'Invite', 'info');
  },
});
export const { slash, aliases, execute } = command;
export default command;
