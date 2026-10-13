import { MessageFlags } from 'discord.js';
import type { Message } from 'discord.js';
import type { CommandContext, CommandReply } from '../../framework/CommandContext.js';
import type {
  InteractionRouter,
  InteractionSessionHandle,
} from '../../framework/InteractionRouter.js';
import type { CommandPolicy } from '../utils/permissions.js';
import { pageButtons } from './components.js';
import { AsyncLock } from '../utils/AsyncLock.js';

export function replyEditor(
  context: CommandContext,
  message: Message,
): (payload: CommandReply) => Promise<void> {
  return async (payload) => {
    const options = { ...payload, allowedMentions: { parse: [] as [] } };
    if (message.flags.has(MessageFlags.Ephemeral) && context.origin.kind !== 'prefix')
      await context.origin.interaction.webhook.editMessage(message.id, options);
    else await message.edit(options);
  };
}
export async function responseChannel(context: CommandContext): Promise<string> {
  return context.privateResponse && context.origin.kind === 'prefix'
    ? (await context.user.createDM()).id
    : context.channel.id;
}
export interface PageRender {
  payload: CommandReply;
  page: number;
  pages: number;
}

/** Actor-bound menus retain the original guild even when their message is in a DM. */
export class Paginator {
  private readonly sessions = new Set<InteractionSessionHandle>();
  private readonly expirations = new Set<Promise<void>>();
  constructor(private readonly router: InteractionRouter) {}
  async open(
    context: CommandContext,
    initialPage: number,
    render: (context: CommandContext, page: number) => Promise<PageRender>,
    policy: CommandPolicy = {},
    live?: { intervalMs: number; active: () => boolean },
  ): Promise<void> {
    let page = initialPage;
    let edit: ((payload: CommandReply) => Promise<void>) | null = null;
    let expired = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const lock = new AsyncLock();
    const update = async (fresh: CommandContext, requested: number) => {
      await lock.run(async () => {
        if (expired) return;
        const result = await render(fresh, requested);
        if (expired) return;
        page = result.page;
        await edit?.({ ...result.payload, components: pageButtons(handle, page, result.pages) });
      });
    };
    const handle = this.router.register({
      guildId: context.guildId,
      channelId: await responseChannel(context),
      sourceChannelId: context.channel.id,
      userId: context.user.id,
      lifetimeMs: 120_000,
      policy,
      acknowledgment: 'update',
      actions: {
        back: (fresh) => update(fresh, page - 1),
        next: (fresh) => update(fresh, page + 1),
      },
      onExpire: async () => {
        expired = true;
        if (timer) clearInterval(timer);
        this.sessions.delete(handle);
        const done = lock.run(async () => {
          await edit?.({ components: [] });
        });
        this.expirations.add(done);
        try {
          await done;
        } finally {
          this.expirations.delete(done);
        }
      },
    });
    this.sessions.add(handle);
    try {
      const result = await render(context, initialPage);
      page = result.page;
      const message = await context.respond({
        ...result.payload,
        components: pageButtons(handle, page, result.pages),
      });
      edit = replyEditor(context, message);
      handle.bind(message.id);
      if (live) {
        timer = setInterval(() => {
          if (!live.active()) {
            handle.dispose();
            return;
          }
          void update(context, page).catch(() => handle.dispose());
        }, live.intervalMs);
        timer.unref();
      }
    } catch (error) {
      handle.dispose();
      throw error;
    }
  }
  async close(): Promise<void> {
    for (const session of this.sessions) session.dispose();
    this.sessions.clear();
    await Promise.allSettled([...this.expirations]);
  }
}
