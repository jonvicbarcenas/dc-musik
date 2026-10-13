import {
  ApplicationIntegrationType,
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { SlashCommandSubcommandBuilder } from 'discord.js';
import type { CommandContext } from './CommandContext.js';
import type { Arguments, ArgumentSchema, ArgumentSpec } from './ArgumentParser.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export const categories = ['playback', 'queue', 'audio', 'extras', 'admin'] as const;
export type CommandCategory = (typeof categories)[number];
export interface CommandDefinition extends ArgumentSchema {
  name: string;
  description: string;
  category: CommandCategory;
  aliases?: readonly string[];
  policy?: CommandPolicy | ((args: Arguments) => CommandPolicy);
  ephemeral?: boolean;
  execute(this: void, context: CommandContext): Promise<void>;
}
export interface Command extends CommandDefinition {
  slash: SlashCommandBuilder;
  aliases: readonly string[];
  policy: CommandPolicy | ((args: Arguments) => CommandPolicy);
  ephemeral: boolean;
}

export function defineCommand(definition: CommandDefinition): Command {
  const slash = new SlashCommandBuilder()
    .setName(definition.name)
    .setDescription(definition.description)
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
  if (typeof definition.policy !== 'function' && definition.policy?.admin)
    slash.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
  if (definition.subcommands?.length) {
    for (const sub of definition.subcommands)
      slash.addSubcommand((builder) => {
        builder.setName(sub.name).setDescription(sub.description);
        addOptions(builder, sub.arguments ?? []);
        return builder;
      });
  } else addOptions(slash, definition.arguments ?? []);
  return {
    ...definition,
    slash,
    aliases: definition.aliases ?? [],
    policy: definition.policy ?? {},
    ephemeral: definition.ephemeral ?? false,
  };
}
function addOptions(
  builder: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  specs: readonly ArgumentSpec[],
): void {
  // Slash requires required options first; prefix retains the declared positional order.
  for (const spec of [...specs].sort(
    (a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)),
  )) {
    const common = {
      name: spec.name,
      description: spec.description,
      required: spec.required ?? false,
    };
    switch (spec.kind) {
      case 'integer':
        builder.addIntegerOption((option) => {
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required);
          if (spec.minimum !== undefined) option.setMinValue(spec.minimum);
          if (spec.maximum !== undefined) option.setMaxValue(spec.maximum);
          return option;
        });
        break;
      case 'number':
        builder.addNumberOption((option) => {
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required);
          if (spec.minimum !== undefined) option.setMinValue(spec.minimum);
          if (spec.maximum !== undefined) option.setMaxValue(spec.maximum);
          return option;
        });
        break;
      case 'boolean':
        builder.addBooleanOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required),
        );
        break;
      case 'role':
        builder.addRoleOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required),
        );
        break;
      case 'channel':
        builder.addChannelOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
              ChannelType.AnnouncementThread,
            ),
        );
        break;
      case 'attachment':
        builder.addAttachmentOption((option) =>
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required),
        );
        break;
      default:
        builder.addStringOption((option) => {
          option
            .setName(common.name)
            .setDescription(common.description)
            .setRequired(common.required)
            .setMaxLength(spec.maxLength ?? 4096);
          if (spec.choices)
            option.addChoices(...spec.choices.map((value) => ({ name: value, value })));
          return option;
        });
    }
  }
}

export const arg = {
  text: (
    name: string,
    description: string,
    required = true,
    rest = false,
    maxLength = 4096,
  ): ArgumentSpec => ({ name, description, kind: 'string', required, rest, maxLength }),
  integer: (
    name: string,
    description: string,
    required = true,
    minimum = 1,
    maximum = 10_000,
  ): ArgumentSpec => ({ name, description, kind: 'integer', required, minimum, maximum }),
  number: (name: string, description: string, minimum = 0.25, maximum = 4): ArgumentSpec => ({
    name,
    description,
    kind: 'number',
    required: true,
    minimum,
    maximum,
  }),
  boolean: (name = 'enabled', description = 'On or off', required = true): ArgumentSpec => ({
    name,
    description,
    kind: 'boolean',
    required,
  }),
  choice: (
    name: string,
    description: string,
    choices: readonly string[],
    required = true,
  ): ArgumentSpec => ({ name, description, kind: 'enum', choices, required, maxLength: 100 }),
  duration: (
    name = 'time',
    description = 'Seconds, mm:ss, hh:mm:ss, or 1m30s',
    minimum = 0,
    maximum = 86_400_000,
  ): ArgumentSpec => ({
    name,
    description,
    kind: 'duration',
    required: true,
    minimum,
    maximum,
    maxLength: 30,
  }),
};
