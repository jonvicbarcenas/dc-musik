import { escapeMarkdown, MessageFlags } from 'discord.js';
import type { Message } from 'discord.js';
import type { CommandContext, CommandReply } from '../../framework/CommandContext.js';
import type { CommandServices } from '../../framework/CommandServices.js';
import { CommandError } from '../../framework/errors.js';
import type { GuildSettings, QueueSnapshot, StoredTrack } from '../db/models.js';
import type { Lyrics } from '../music/LyricsService.js';
import { cleanText, safeWebUrl } from '../utils/text.js';
import { translate as t } from '../utils/i18n.js';
import { formatTime } from '../utils/time.js';
import { baseEmbed } from './embeds.js';
import { replyEditor } from './Paginator.js';

const POLL_MS = 500;
const EDIT_INTERVAL_MS = 1500;
const MAX_LIFETIME_MS = 86_400_000;

interface KaraokeSession {
  guildId: string;
  playbackId: string;
  track: StoredTrack;
  lyrics: Lyrics;
  settings: GuildSettings;
  message: Message;
  edit: (payload: CommandReply) => Promise<void>;
  lastKey: string;
  lastSentAt: number;
  expiresAt: number;
  active: boolean;
  running: Promise<void> | null;
  stopping: Promise<void> | null;
}
type EndReason = 'ended' | 'stopped';

/** Poll locally; serialize edits and send only changed lyric/status frames. */
export class KaraokeView {
  private readonly sessions = new Set<KaraokeSession>();
  private readonly finishing = new Set<Promise<void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private closing = false;

  constructor(
    private readonly services: CommandServices,
    private readonly onFinish: (message: Message) => Promise<void>,
  ) {}

  async open(context: CommandContext, track: StoredTrack, lyrics: Lyrics): Promise<void> {
    const snapshot = this.services.players.view(context.guildId);
    if (this.closing || !snapshot?.currentPlaybackId || snapshot.current?.track.key !== track.key)
      throw new CommandError('ARGUMENT', 'The track changed. Run lyrics again.');
    const ordered = [...lyrics.lines].sort((a, b) => a.timestampMs - b.timestampMs);
    const lines: Lyrics['lines'] = [];
    for (const line of ordered) {
      const previous = lines.at(-1);
      if (previous?.timestampMs === line.timestampMs)
        previous.text = `${previous.text} / ${line.text}`.slice(0, 1000);
      else lines.push({ ...line });
    }
    const normalized = { ...lyrics, lines };
    const initial = frame(track, normalized, snapshot, context.settings);
    context.keepResponse = true;
    const message = await context.respond(initial.payload);
    const session: KaraokeSession = {
      guildId: context.guildId,
      playbackId: snapshot.currentPlaybackId,
      track,
      lyrics: normalized,
      settings: context.settings,
      message,
      edit: replyEditor(context, message),
      lastKey: initial.key,
      lastSentAt: Date.now(),
      expiresAt: message.flags.has(MessageFlags.Ephemeral)
        ? Math.min(Date.now() + MAX_LIFETIME_MS, context.createdTimestamp + 840_000)
        : Date.now() + MAX_LIFETIME_MS,
      active: true,
      running: null,
      stopping: null,
    };
    this.sessions.add(session);
    if (
      this.closing ||
      this.services.players.view(session.guildId)?.currentPlaybackId !== session.playbackId
    ) {
      await this.finish(session, this.closing ? 'stopped' : 'ended');
      return;
    }
    // A repeated request in the same public channel replaces its previous view.
    const older = [...this.sessions].filter(
      (item) =>
        item !== session &&
        item.guildId === session.guildId &&
        item.message.channelId === message.channelId &&
        !item.message.flags.has(MessageFlags.Ephemeral) &&
        !message.flags.has(MessageFlags.Ephemeral),
    );
    for (const item of older) await this.finish(item, 'stopped');
    const guildSessions = [...this.sessions].filter((item) => item.guildId === session.guildId);
    while (guildSessions.length > 3) {
      const oldest = guildSessions.shift();
      if (oldest) await this.finish(oldest, 'stopped');
    }
    if (!this.timer && !this.closing) {
      this.timer = setInterval(() => this.refresh(), POLL_MS);
      this.timer.unref();
    }
  }

  refresh(guildId?: string): void {
    if (this.closing) return;
    for (const session of this.sessions) {
      if (!session.active || (guildId && session.guildId !== guildId)) continue;
      const snapshot = this.services.players.view(session.guildId);
      if (snapshot?.currentPlaybackId !== session.playbackId || !snapshot.current) {
        void this.finish(session, 'ended');
        continue;
      }
      if (Date.now() >= session.expiresAt) {
        void this.finish(session, 'stopped');
        continue;
      }
      if (session.running || Date.now() - session.lastSentAt < EDIT_INTERVAL_MS) continue;
      const next = frame(session.track, session.lyrics, snapshot, session.settings);
      if (next.key === session.lastKey) continue;
      session.running = session
        .edit(next.payload)
        .then(() => {
          session.lastKey = next.key;
          session.lastSentAt = Date.now();
        })
        .catch(() => {
          this.services.logger.warn({ messageId: session.message.id }, 'Lyrics view unavailable.');
          void this.finish(session, 'stopped', false);
        })
        .finally(() => {
          session.running = null;
        });
    }
  }

  async end(guildId: string, playbackId?: string | null): Promise<void> {
    await Promise.all(
      [...this.sessions]
        .filter(
          (item) => item.guildId === guildId && (!playbackId || item.playbackId === playbackId),
        )
        .map((item) => this.finish(item, 'ended')),
    );
  }

  private finish(session: KaraokeSession, reason: EndReason, edit = true): Promise<void> {
    if (session.stopping) return session.stopping;
    session.active = false;
    this.sessions.delete(session);
    if (!this.sessions.size && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const done = (async () => {
      await session.running;
      if (edit) {
        const snapshot = this.services.players.view(session.guildId);
        await session
          .edit(frame(session.track, session.lyrics, snapshot, session.settings, reason).payload)
          .catch(() => undefined);
      }
      await this.onFinish(session.message).catch(() => undefined);
    })();
    session.stopping = done;
    this.finishing.add(done);
    void done.finally(() => this.finishing.delete(done));
    return done;
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await Promise.all([...this.sessions].map((item) => this.finish(item, 'stopped')));
    await Promise.allSettled([...this.finishing]);
  }
}

function frame(
  track: StoredTrack,
  lyrics: Lyrics,
  snapshot: QueueSnapshot | null,
  settings: GuildSettings,
  ended?: EndReason,
): { key: string; payload: CommandReply } {
  const language = settings.language;
  const position = snapshot?.positionMs ?? 0;
  // Binary search permits backward seeking and avoids scanning an entire lyric on each poll.
  let low = 0;
  let high = lyrics.lines.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((lyrics.lines[mid]?.timestampMs ?? Infinity) <= position) low = mid + 1;
    else high = mid;
  }
  const index = low - 1;
  const status = ended
    ? t(language, ended === 'ended' ? 'ended' : 'lyricsStopped')
    : t(language, snapshot?.paused ? 'paused' : 'nowPlaying');
  const display = (line: Lyrics['lines'][number]) =>
    escapeMarkdown(
      line.text.trim() ? cleanText(line.text, 400) : t(language, 'lyricsInstrumental'),
    );
  const current = lyrics.lines[index];
  const previous = lyrics.lines[index - 1];
  const nearby: string[] = [];
  if (previous) nearby.push(`> ${display(previous)}`);
  nearby.push(`▶ **${current ? display(current) : t(language, 'lyricsIntro')}**`);
  for (const line of lyrics.lines.slice(index + 1, index + 3)) nearby.push(`> ${display(line)}`);
  const embed = baseEmbed(settings)
    .setTitle(`${t(language, 'lyrics')} · ${cleanText(track.title, 170)}`)
    .setAuthor({ name: `${t(language, 'karaoke')} · ${status}` })
    .setDescription(ended ? t(language, 'lyricsFinished') : nearby.join('\n\n'))
    .setFooter({ text: `${cleanText(lyrics.provider, 100)} · ${t(language, 'syncedLyrics')}` });
  if (!ended && current)
    embed.addFields({
      name: t(language, 'lyricTimestamp'),
      value: formatTime(current.timestampMs),
    });
  const artwork = safeWebUrl(track.artworkUrl);
  if (artwork) embed.setThumbnail(artwork);
  return {
    key: `${index}:${status}`,
    payload: { embeds: [embed], components: [] },
  };
}
