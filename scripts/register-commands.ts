import { writeFile } from 'node:fs/promises';
import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { createCommandRegistry } from '../src/commands/index.js';
import { ConfigurationError, loadEnv } from '../src/config/env.js';

interface Options {
  dryRun: boolean;
  guildId: string | null;
  global: boolean;
  output: string | null;
}
function options(argv: readonly string[]): Options {
  const result: Options = { dryRun: false, guildId: null, global: false, output: null };
  for (let index = 0; index < argv.length; index++) {
    switch (argv[index]) {
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--global':
        result.global = true;
        break;
      case '--guild': {
        const id = argv[++index];
        if (!id || !/^\d{17,20}$/.test(id)) throw new Error('Use --guild with a server ID.');
        result.guildId = id;
        break;
      }
      case '--output': {
        const path = argv[++index];
        if (!path) throw new Error('Use --output with a file path.');
        result.output = path;
        break;
      }
      default:
        throw new Error('Use --dry-run, --guild ID, --global, and optionally --output PATH.');
    }
  }
  if ((result.global && result.guildId) || (result.output && !result.dryRun))
    throw new Error('Choose one scope. --output requires --dry-run.');
  return result;
}

try {
  const arguments_ = options(process.argv.slice(2));
  const body = createCommandRegistry().toJSON();
  if (arguments_.dryRun) {
    const json = JSON.stringify(body, null, 2) + '\n';
    if (arguments_.output) {
      await writeFile(arguments_.output, json, 'utf8');
      console.info(`Validated ${body.length} slash commands; wrote the dry-run JSON.`);
    } else console.info(json);
  } else {
    const env = loadEnv();
    const guildId = arguments_.global ? null : (arguments_.guildId ?? env.DISCORD_GUILD_ID ?? null);
    const applicationSchema = z.object({ id: z.string().regex(/^\d{17,20}$/) });
    const accounts = [env.DISCORD_TOKEN, ...env.EXTRA_BOT_TOKENS];
    for (const [index, token] of accounts.entries()) {
      const rest = new REST({ version: '10', retries: 3, timeout: 30_000 }).setToken(token);
      const application = applicationSchema.parse(
        await rest.get(Routes.oauth2CurrentApplication()),
      );
      if (index === 0 && application.id !== env.DISCORD_CLIENT_ID)
        throw new Error('Application ID mismatch.');
      const route = guildId
        ? Routes.applicationGuildCommands(application.id, guildId)
        : Routes.applicationCommands(application.id);
      await rest.put(route, { body });
      console.info(
        `Registered ${body.length} ${guildId ? 'guild' : 'global'} commands for application ${application.id}.`,
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'Command registration failed. Check CLI flags, token/application IDs, and guild access. No secret values are logged.',
  );
  process.exitCode = 1;
}
