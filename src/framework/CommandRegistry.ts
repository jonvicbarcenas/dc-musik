import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { Command, CommandCategory } from './Command.js';

export class CommandRegistry {
  private readonly names = new Map<string, Command>();
  private readonly commands: readonly Command[];
  constructor(commands: readonly Command[]) {
    if (commands.length > 100) throw new Error('Discord allows at most 100 chat-input commands.');
    this.commands = [...commands];
    for (const command of commands) {
      for (const name of [command.name, ...command.aliases]) {
        const key = name.toLowerCase();
        if (this.names.has(key)) throw new Error(`Duplicate command name or alias: ${key}`);
        this.names.set(key, command);
      }
      command.slash.toJSON(); // Fail locally on invalid Discord schemas, before registering anything.
    }
  }
  get(name: string): Command | null {
    return this.names.get(name.toLowerCase()) ?? null;
  }
  all(category?: CommandCategory): Command[] {
    return this.commands.filter((command) => !category || command.category === category);
  }
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return this.commands.map((command) => command.slash.toJSON());
  }
}
