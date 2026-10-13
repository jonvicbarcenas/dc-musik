import { randomBytes } from 'node:crypto';
import { MessageFlags } from 'discord.js';
import type { MessageComponentInteraction } from 'discord.js';
import type { CommandContext } from './CommandContext.js';
import type { CommandHandler } from './CommandHandler.js';
import { CommandError, commandErrorCode, commandErrorMessage } from './errors.js';
import type { CommandPolicy } from '../lib/utils/permissions.js';

export interface InteractionSessionOptions {
  guildId: string;
  channelId: string;
  sourceChannelId?: string;
  userId: string | null;
  lifetimeMs: number;
  policy: CommandPolicy;
  acknowledgment?: 'reply' | 'update';
  once?: boolean;
  actions: Readonly<
    Record<string, (context: CommandContext, values: readonly string[]) => Promise<void>>
  >;
  onExpire?: () => Promise<void>;
}
export interface InteractionSessionHandle {
  id(action: string): string;
  bind(messageId: string): void;
  dispose(): void;
}
interface Session {
  options: InteractionSessionOptions;
  messageId: string | null;
  expiresAt: number;
  busy: Set<string>;
  timer: ReturnType<typeof setTimeout>;
}

/** Opaque, message-bound sessions. Copying or editing custom IDs never authorizes an action. */
export class InteractionRouter {
  private readonly sessions = new Map<string, Session>();
  private readonly active = new Set<Promise<boolean>>();
  constructor(
    private readonly handler: CommandHandler,
    private readonly maximum = 2000,
  ) {}
  register(options: InteractionSessionOptions): InteractionSessionHandle {
    if (this.sessions.size >= this.maximum)
      throw new CommandError('COOLDOWN', 'Too many active menus. Try again shortly.');
    if (
      !Number.isInteger(options.lifetimeMs) ||
      options.lifetimeMs < 1000 ||
      options.lifetimeMs > 86_400_000 ||
      !Object.keys(options.actions).length ||
      Object.keys(options.actions).some((action) => !/^[a-z0-9_-]{1,24}$/.test(action))
    )
      throw new Error('Invalid interaction session.');
    const nonce = randomBytes(16).toString('base64url');
    const timer = setTimeout(() => this.remove(nonce), options.lifetimeMs);
    timer.unref();
    this.sessions.set(nonce, {
      options,
      messageId: null,
      expiresAt: Date.now() + options.lifetimeMs,
      busy: new Set(),
      timer,
    });
    return {
      id: (action) => {
        if (!Object.hasOwn(options.actions, action)) throw new Error('Unknown action.');
        return `dms:${nonce}:${action}`;
      },
      bind: (messageId) => {
        const session = this.sessions.get(nonce);
        if (session) session.messageId = messageId;
      },
      dispose: () => this.remove(nonce),
    };
  }
  owns(customId: string): boolean {
    return this.sessions.has(customId.split(':')[1] ?? '');
  }
  handle(interaction: MessageComponentInteraction): Promise<boolean> {
    const task = this.dispatch(interaction);
    this.active.add(task);
    void task.then(
      () => this.active.delete(task),
      () => this.active.delete(task),
    );
    return task;
  }
  private async dispatch(interaction: MessageComponentInteraction): Promise<boolean> {
    const match = /^dms:([A-Za-z0-9_-]{22}):([a-z0-9_-]{1,24})$/.exec(interaction.customId);
    if (!match) return false;
    const nonce = match[1] ?? '';
    const action = match[2] ?? '';
    const session = this.sessions.get(nonce);
    try {
      if (!session || session.expiresAt <= Date.now())
        throw new CommandError('ARGUMENT', 'This menu expired. Run the command again.');
      if (
        (interaction.guildId !== null && session.options.guildId !== interaction.guildId) ||
        (interaction.guildId === null && !session.options.userId) ||
        session.options.channelId !== interaction.channelId ||
        session.messageId !== interaction.message.id
      )
        throw new CommandError('PERMISSION', 'This control belongs to another message.');
      if (session.options.userId && session.options.userId !== interaction.user.id)
        throw new CommandError('PERMISSION', 'Only the person who opened this menu can use it.');
      const callback = Object.hasOwn(session.options.actions, action)
        ? session.options.actions[action]
        : undefined;
      if (!callback) throw new CommandError('ARGUMENT', 'This action is unavailable.');
      if (session.busy.has(interaction.user.id))
        throw new CommandError('COOLDOWN', 'Your previous action is still running.');
      session.busy.add(interaction.user.id);
      try {
        if (session.options.acknowledgment === 'update') await interaction.deferUpdate();
        else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const context = await this.handler.componentContext(interaction, {
          guildId: session.options.guildId,
          channelId: session.options.sourceChannelId ?? session.options.channelId,
        });
        await this.handler.guard(context, session.options.policy);
        await callback(context, interaction.isStringSelectMenu() ? interaction.values : []);
        if (session.options.once) this.remove(nonce);
      } finally {
        session.busy.delete(interaction.user.id);
      }
    } catch (error) {
      this.handler.services.logger.warn(
        { code: commandErrorCode(error) },
        'Control action failed.',
      );
      const response = {
        content: commandErrorMessage(error),
        flags: MessageFlags.Ephemeral as const,
        allowedMentions: { parse: [] as [] },
      };
      if (interaction.deferred || interaction.replied)
        await interaction.followUp(response).catch(() => undefined);
      else await interaction.reply(response).catch(() => undefined);
    }
    return true;
  }
  private remove(nonce: string): void {
    const session = this.sessions.get(nonce);
    if (!session) return;
    clearTimeout(session.timer);
    this.sessions.delete(nonce);
    if (session.options.onExpire) void session.options.onExpire().catch(() => undefined);
  }
  close(): void {
    for (const nonce of this.sessions.keys()) this.remove(nonce);
  }
  async drain(): Promise<void> {
    await Promise.allSettled([...this.active]);
  }
}
