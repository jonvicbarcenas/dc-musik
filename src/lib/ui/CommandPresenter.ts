import { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } from 'discord.js';
import type { Message } from 'discord.js';
import type { CommandContext, CommandReply } from '../../framework/CommandContext.js';
import type { CommandUI, CommandView } from '../../framework/CommandUI.js';
import type { CommandHandler } from '../../framework/CommandHandler.js';
import type {
  InteractionRouter,
  InteractionSessionHandle,
} from '../../framework/InteractionRouter.js';
import { CommandError } from '../../framework/errors.js';
import type { CommandServices } from '../../framework/CommandServices.js';
import type { GuildSettings, QueueSnapshot } from '../db/models.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { checkTextPermissions } from '../utils/permissions.js';
import { cleanText } from '../utils/text.js';
import { translate as t } from '../utils/i18n.js';
import { formatTime } from '../utils/time.js';
import { baseEmbed, nowPlayingEmbed, queueEmbed, viewEmbed } from './embeds.js';
import { controllerButtons, helpMenu } from './components.js';
import { Paginator, replyEditor, responseChannel } from './Paginator.js';
import { MessageEditor } from './MessageEditor.js';

interface Controller {
  guildId: string;
  playbackId: string;
  message: Message | null;
  session: InteractionSessionHandle;
  edit: ((payload: CommandReply) => Promise<void>) | null;
  active: boolean;
}
export class CommandPresenter implements CommandUI {
  private services!: CommandServices;
  private handler!: CommandHandler;
  private router!: InteractionRouter;
  private paginator!: Paginator;
  private editor!: MessageEditor;
  private readonly controllers = new Set<Controller>();
  private readonly announcementLocks = new Map<string, AsyncLock>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private closing = false;
  private readonly cleanup = new Set<ReturnType<typeof setTimeout>>();
  bind(services: CommandServices, handler: CommandHandler, router: InteractionRouter): void {
    this.services = services;
    this.handler = handler;
    this.router = router;
    this.paginator = new Paginator(router);
    this.editor = new MessageEditor(services.env.CONTROLLER_UPDATE_INTERVAL_MS, services.logger);
    this.timer = setInterval(() => {
      for (const guildId of services.players.guildIds()) this.refresh(guildId);
    }, services.env.CONTROLLER_UPDATE_INTERVAL_MS);
    this.timer.unref();
  }
  async present(context: CommandContext, view: CommandView): Promise<void> {
    if (this.closing) throw new CommandError('COOLDOWN', 'The bot is restarting.');
    if (view.kind === 'nowplaying' && view.snapshot.current) {
      context.keepResponse = true;
      await this.controller(
        view.snapshot,
        context.settings,
        (payload) => context.respond(payload),
        context,
      );
    } else if (view.kind === 'queue' || view.kind === 'tracks' || view.kind === 'list') {
      const initial = view.kind === 'queue' ? view.page : view.page.page;
      await this.paginator.open(
        context,
        initial,
        async (fresh, page) => {
          const next = await view.onPage(fresh, Math.max(1, page));
          if (next.kind === 'queue') {
            const result = queueEmbed(next.snapshot, next.page, fresh.settings);
            return { payload: { embeds: [result.embed] }, page: result.page, pages: result.pages };
          }
          if (next.kind !== 'tracks' && next.kind !== 'list')
            throw new CommandError('ARGUMENT', 'This page is unavailable.');
          return {
            payload: { embeds: [viewEmbed(next, fresh.settings, fresh.requester)] },
            page: next.page.page,
            pages: Math.max(1, next.page.totalPages),
          };
        },
        view.kind === 'queue' ? { musicChannel: true } : {},
      );
    } else if (view.kind === 'search') await this.search(context, view);
    else if (view.kind === 'help') await this.help(context, view);
    else if (view.kind === 'lyrics') await this.lyrics(context, view);
    else await context.respond({ embeds: [viewEmbed(view, context.settings, context.requester)] });
  }
  private async search(
    context: CommandContext,
    view: Extract<CommandView, { kind: 'search' }>,
  ): Promise<void> {
    let edit: ((payload: CommandReply) => Promise<void>) | null = null;
    const handle = this.router.register({
      guildId: context.guildId,
      channelId: await responseChannel(context),
      sourceChannelId: context.channel.id,
      userId: context.user.id,
      lifetimeMs: 60_000,
      once: true,
      policy: { voice: 'join', dj: true, musicChannel: true },
      actions: {
        select: async (fresh, values) => {
          if (values.length !== 1 || !/^\d$/.test(values[0] ?? ''))
            throw new CommandError('ARGUMENT', 'Choose one search result.');
          await view.onSelect(fresh, Number(values[0]));
        },
      },
      onExpire: async () => {
        await edit?.({ components: [] });
      },
    });
    try {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(handle.id('select'))
        .setPlaceholder(t(context.settings.language, 'search'))
        .addOptions(
          view.items.slice(0, 10).map((item, index) => ({
            label: cleanText(item.track.title, 100),
            value: String(index),
            description: cleanText(
              `${item.track.artist} · ${item.track.isStream ? 'LIVE' : formatTime(item.track.durationMs)}`,
              100,
            ),
          })),
        );
      const message = await context.respond({
        embeds: [viewEmbed(view, context.settings, context.requester)],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      });
      edit = replyEditor(context, message);
      handle.bind(message.id);
    } catch (error) {
      handle.dispose();
      throw error;
    }
  }
  private async help(
    context: CommandContext,
    view: Extract<CommandView, { kind: 'help' }>,
  ): Promise<void> {
    let edit: ((payload: CommandReply) => Promise<void>) | null = null;
    const render = (fresh: CommandContext, selected = view.selected): CommandReply => {
      const admin =
        this.services.env.OWNER_IDS.includes(fresh.user.id) ||
        fresh.member.permissions.has(PermissionFlagsBits.ManageGuild);
      const entries = view.entries.filter((entry) => entry.category !== 'admin' || admin);
      const available = [...new Set(entries.map((entry) => entry.category))];
      const category = available.includes(selected) ? selected : 'playback';
      return {
        embeds: [
          viewEmbed({ ...view, selected: category, entries }, fresh.settings, fresh.requester),
        ],
        components: helpMenu(handle, available, category, fresh.settings.language),
      };
    };
    const handle = this.router.register({
      guildId: context.guildId,
      channelId: await responseChannel(context),
      sourceChannelId: context.channel.id,
      userId: context.user.id,
      lifetimeMs: 120_000,
      policy: {},
      acknowledgment: 'update',
      actions: {
        category: async (fresh, values) => {
          const selected = view.entries.find((entry) => entry.category === values[0])?.category;
          if (!selected || values.length !== 1)
            throw new CommandError('ARGUMENT', 'Choose a command category.');
          await edit?.(render(fresh, selected));
        },
      },
      onExpire: async () => {
        await edit?.({ components: [] });
      },
    });
    try {
      const message = await context.respond(render(context));
      edit = replyEditor(context, message);
      handle.bind(message.id);
    } catch (error) {
      handle.dispose();
      throw error;
    }
  }
  private async lyrics(
    context: CommandContext,
    view: Extract<CommandView, { kind: 'lyrics' }>,
  ): Promise<void> {
    const playbackId = context.snapshot?.currentPlaybackId;
    const lines = view.lyrics.lines.length
      ? view.lyrics.lines.map((line) => `[${formatTime(line.timestampMs)}] ${line.text}`)
      : view.lyrics.text.split(/\r?\n/);
    const pages: string[] = [];
    let chunk = '';
    for (const line of lines) {
      for (let offset = 0; offset < Math.max(1, line.length); offset += 2000) {
        const section = line.slice(offset, offset + 2000);
        const part = section.trim() ? cleanText(section, 2000) : '';
        if (chunk.length + part.length + 1 > 3000) {
          pages.push(chunk);
          chunk = '';
        }
        chunk += `${part}\n`;
      }
    }
    if (chunk) pages.push(chunk);
    if (!pages.length) pages.push('—');
    await this.paginator.open(
      context,
      1,
      (fresh, requested) => {
        const page = Math.max(1, Math.min(pages.length, requested));
        const position = fresh.snapshot?.positionMs ?? 0;
        const current = view.lyrics.lines.filter((line) => line.timestampMs <= position).at(-1);
        const description = `${pages[page - 1] ?? '—'}${current ? `\n▶ ${cleanText(current.text, 500)}` : ''}`;
        const embed = baseEmbed(fresh.settings)
          .setTitle(`${t(fresh.settings.language, 'lyrics')} · ${cleanText(view.track.title, 170)}`)
          .setDescription(description)
          .setAuthor({
            name: `${view.lyrics.provider} · ${t(fresh.settings.language, 'page', { page, pages: pages.length })}`,
          });
        return Promise.resolve({ payload: { embeds: [embed] }, page, pages: pages.length });
      },
      { musicChannel: true },
      view.lyrics.lines.length
        ? {
            intervalMs: this.services.env.CONTROLLER_UPDATE_INTERVAL_MS,
            active: () => context.snapshot?.currentPlaybackId === playbackId,
          }
        : undefined,
    );
  }
  async announce(snapshot: QueueSnapshot): Promise<void> {
    if (this.closing || !snapshot.current || !snapshot.currentPlaybackId || !snapshot.textChannelId)
      return;
    let lock = this.announcementLocks.get(snapshot.guildId);
    if (!lock) {
      lock = new AsyncLock();
      this.announcementLocks.set(snapshot.guildId, lock);
    }
    await lock.run(async () => {
      if (
        this.closing ||
        this.services.players.view(snapshot.guildId)?.currentPlaybackId !==
          snapshot.currentPlaybackId
      )
        return;
      if (
        [...this.controllers].some(
          (record) =>
            record.active &&
            record.guildId === snapshot.guildId &&
            record.playbackId === snapshot.currentPlaybackId,
        )
      ) {
        this.refresh(snapshot.guildId);
        return;
      }
      const settings = await this.services.repositories.guildSettings.get(snapshot.guildId);
      if (!settings.announceNowPlaying) return;
      const guild = this.services.client.guilds.cache.get(snapshot.guildId);
      const channel =
        guild && snapshot.textChannelId ? await guild.channels.fetch(snapshot.textChannelId) : null;
      if (!channel?.isTextBased() || !channel.isSendable() || !guild) return;
      checkTextPermissions(await guild.members.fetch(this.services.players.botId), channel);
      await this.controller(snapshot, settings, (payload) =>
        channel.send({ ...payload, allowedMentions: { parse: [] } }),
      );
    });
  }
  private async controller(
    snapshot: QueueSnapshot,
    settings: GuildSettings,
    send: (payload: CommandReply) => Promise<Message>,
    context?: CommandContext,
  ): Promise<void> {
    const playbackId = snapshot.currentPlaybackId;
    if (!playbackId || !snapshot.textChannelId) return;
    const invoke = async (fresh: CommandContext, action: string) => {
      const current = this.services.players.view(snapshot.guildId);
      if (current?.currentPlaybackId !== playbackId)
        throw new CommandError('ARGUMENT', 'This track ended. Use the current controller.');
      fresh.expectedPlaybackId = playbackId;
      if (action === 'pause')
        await this.handler.invokeComponent(fresh, current.paused ? 'resume' : 'pause');
      else if (action === 'loop')
        await this.handler.invokeComponent(fresh, 'loop', {
          mode:
            current.loopMode === 'off' ? 'track' : current.loopMode === 'track' ? 'queue' : 'off',
        });
      else if (action === 'quieter' || action === 'louder')
        await this.handler.invokeComponent(fresh, 'volume', {
          percent: Math.max(1, Math.min(200, current.volume + (action === 'louder' ? 10 : -10))),
        });
      else if (action === 'favorite')
        await this.handler.invokeComponent(fresh, 'favorites', {}, 'add');
      else await this.handler.invokeComponent(fresh, action);
    };
    const session = this.router.register({
      guildId: snapshot.guildId,
      channelId: context ? await responseChannel(context) : snapshot.textChannelId,
      sourceChannelId: context?.channel.id ?? snapshot.textChannelId,
      userId: context?.privateResponse ? context.user.id : null,
      lifetimeMs: 86_400_000,
      policy: { voice: 'same', player: true, musicChannel: true },
      actions: Object.fromEntries(
        [
          'previous',
          'pause',
          'skip',
          'stop',
          'shuffle',
          'loop',
          'quieter',
          'louder',
          'queue',
          'favorite',
        ].map((action) => [action, (fresh: CommandContext) => invoke(fresh, action)]),
      ),
      onExpire: async () => {
        if (record) await this.finish(record);
      },
    });
    const record: Controller = {
      guildId: snapshot.guildId,
      playbackId,
      message: null,
      session,
      edit: null,
      active: true,
    };
    this.controllers.add(record);
    try {
      const message = await send({
        embeds: [nowPlayingEmbed(snapshot, settings)],
        components: controllerButtons(session, snapshot, settings.language),
      });
      record.message = message;
      this.editor.register(message.id);
      record.edit = context
        ? replyEditor(context, message)
        : async (payload) => {
            await message.edit({ ...payload, allowedMentions: { parse: [] } });
          };
      session.bind(message.id);
      if (
        this.closing ||
        this.services.players.view(snapshot.guildId)?.currentPlaybackId !== playbackId
      )
        await this.finish(record);
      const older = [...this.controllers].filter(
        (item) => item.active && item.guildId === snapshot.guildId,
      );
      while (older.length > 3) {
        const oldest = older.shift();
        if (oldest) await this.finish(oldest);
      }
    } catch (error) {
      await this.finish(record);
      throw error;
    }
  }
  refresh(guildId: string): void {
    if (this.closing) return;
    for (const record of this.controllers) {
      if (!record.active || record.guildId !== guildId || !record.message) continue;
      this.editor.request(record.message.id, async () => {
        const snapshot = this.services.players.view(guildId);
        if (!record.active || snapshot?.currentPlaybackId !== record.playbackId) return;
        const settings = await this.services.repositories.guildSettings.get(guildId);
        if (!record.active) return;
        await record.edit?.({
          embeds: [nowPlayingEmbed(snapshot, settings)],
          components: controllerButtons(record.session, snapshot, settings.language),
        });
      });
    }
  }
  async end(guildId: string, playbackId?: string | null): Promise<void> {
    await Promise.all(
      [...this.controllers]
        .filter(
          (record) =>
            record.guildId === guildId && (!playbackId || record.playbackId === playbackId),
        )
        .map((record) => this.finish(record)),
    );
  }
  private async finish(record: Controller): Promise<void> {
    if (!record.active) return;
    record.active = false;
    record.session.dispose();
    this.controllers.delete(record);
    if (record.message)
      await this.editor.stop(record.message.id, async () => {
        await record.edit?.({ components: [] });
      });
    if (!this.closing && record.message) {
      const settings = await this.services.repositories.guildSettings.get(record.guildId);
      this.scheduleDelete(record.message, settings);
    }
  }
  private scheduleDelete(message: Message, settings: GuildSettings): void {
    if (!settings.cleanMode || !message.guildId || this.closing) return;
    const timer = setTimeout(() => {
      this.cleanup.delete(timer);
      void message.delete().catch(() => undefined);
    }, settings.cleanAfterSeconds * 1000);
    timer.unref();
    this.cleanup.add(timer);
  }
  async notice(guildId: string, message: string): Promise<void> {
    if (this.closing) return;
    const snapshot = this.services.players.view(guildId);
    const guild = this.services.client.guilds.cache.get(guildId);
    const channel =
      snapshot?.textChannelId && guild ? await guild.channels.fetch(snapshot.textChannelId) : null;
    if (!channel?.isTextBased() || !channel.isSendable()) return;
    const settings = await this.services.repositories.guildSettings.get(guildId);
    const sent = await channel.send({
      embeds: [baseEmbed(settings).setColor(0xfee75c).setDescription(cleanText(message, 3800))],
      allowedMentions: { parse: [] },
    });
    this.scheduleDelete(sent, settings);
  }
  async close(): Promise<void> {
    this.closing = true;
    for (const timer of this.cleanup) clearTimeout(timer);
    this.cleanup.clear();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.paginator.close();
    await Promise.all([...this.controllers].map((record) => this.finish(record)));
    await this.editor.close();
    this.announcementLocks.clear();
  }
}
