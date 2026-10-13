import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import type { CommandView } from '../../framework/CommandUI.js';
import type { GuildSettings, QueueSnapshot, Requester, StoredTrack } from '../db/models.js';
import { cleanText, safeWebUrl } from '../utils/text.js';
import { formatTime } from '../utils/time.js';
import { translate as t } from '../utils/i18n.js';
import { progressBar } from '../music/ProgressBar.js';

export const PAGE_SIZE = 10;
const icons: Record<StoredTrack['source'], string> = {
  youtube: '▶️',
  spotify: '🟢',
  soundcloud: '☁️',
  deezer: '🎶',
  applemusic: '🍎',
  yandexmusic: '🎵',
  twitch: '🟣',
  bandcamp: '🎸',
  vimeo: '🎬',
  http: '📁',
  attachment: '📎',
};
export function text(value: string, length = 300): string {
  return escapeMarkdown(cleanText(value, length));
}
export function trackLabel(track: StoredTrack, length = 110): string {
  return `${icons[track.source]} ${text(track.title, length)} — ${text(track.artist, 70)}`;
}
export function baseEmbed(settings: GuildSettings, requester?: Requester): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Number.parseInt(settings.embedColor.slice(1), 16));
  embed.setFooter({
    text: requester
      ? `${t(settings.language, 'requester')} ${cleanText(requester.displayName, 100)} · ${t(settings.language, 'sources')}`
      : t(settings.language, 'sources'),
    ...(requester?.avatarUrl ? { iconURL: requester.avatarUrl } : {}),
  });
  return embed;
}
function artwork(embed: EmbedBuilder, track: StoredTrack): EmbedBuilder {
  const url = track.artworkUrl && safeWebUrl(track.artworkUrl);
  if (url) embed.setThumbnail(url);
  return embed;
}
export function nowPlayingEmbed(snapshot: QueueSnapshot, settings: GuildSettings): EmbedBuilder {
  const current = snapshot.current;
  if (!current)
    return baseEmbed(settings)
      .setTitle(t(settings.language, 'music'))
      .setDescription(t(settings.language, 'empty'));
  const track = current.track;
  const embed = artwork(baseEmbed(settings, current.requester), track)
    .setAuthor({ name: t(settings.language, snapshot.paused ? 'paused' : 'nowPlaying') })
    .setTitle(`${icons[track.source]} ${cleanText(track.title, 240)}`)
    .setDescription(
      `${text(track.artist)}\n\n${progressBar(snapshot.positionMs, current.playable?.durationMs ?? track.durationMs, track.isStream)}`,
    )
    .addFields(
      {
        name: t(settings.language, 'requester'),
        value: text(current.requester.displayName, 100),
        inline: true,
      },
      { name: t(settings.language, 'volume'), value: `${snapshot.volume}%`, inline: true },
      { name: t(settings.language, 'loop'), value: snapshot.loopMode, inline: true },
      {
        name: t(settings.language, 'queue'),
        value: `${snapshot.upcoming.length}${snapshot.autoplay ? ' · 📻' : ''}`,
        inline: true,
      },
    );
  const url = track.uri && safeWebUrl(track.uri);
  if (url) embed.setURL(url);
  const next = snapshot.upcoming[0];
  if (next) embed.addFields({ name: t(settings.language, 'next'), value: trackLabel(next.track) });
  return embed;
}
export function queueEmbed(
  snapshot: QueueSnapshot,
  requested: number,
  settings: GuildSettings,
): { embed: EmbedBuilder; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(snapshot.upcoming.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, requested));
  const start = (page - 1) * PAGE_SIZE;
  const lines = snapshot.upcoming
    .slice(start, start + PAGE_SIZE)
    .map(
      (entry, i) =>
        `**${start + i + 1}.** ${trackLabel(entry.track)} · ${entry.track.isStream ? 'LIVE' : formatTime(entry.track.durationMs)}`,
    );
  const current = snapshot.current ? `**▶ ${trackLabel(snapshot.current.track)}**\n\n` : '';
  const total = snapshot.upcoming.reduce((sum, entry) => sum + entry.track.durationMs, 0);
  const embed = baseEmbed(settings)
    .setTitle(t(settings.language, 'queue'))
    .setDescription(`${current}${lines.join('\n') || t(settings.language, 'empty')}`)
    .addFields({
      name: t(settings.language, 'duration'),
      value: `${formatTime(total)}${snapshot.upcoming.some((entry) => entry.track.isStream) ? ' + LIVE' : ''}`,
    })
    .setAuthor({ name: t(settings.language, 'page', { page, pages }) });
  return { embed, page, pages };
}
export function viewEmbed(
  view: CommandView,
  settings: GuildSettings,
  requester: Requester,
): EmbedBuilder {
  const embed = baseEmbed(settings, requester);
  switch (view.kind) {
    case 'notice':
      return embed
        .setTitle(cleanText(view.title, 256))
        .setDescription(cleanText(view.text, 3800))
        .setColor(
          view.tone === 'warning'
            ? 0xfee75c
            : view.tone === 'success'
              ? 0x57f287
              : Number.parseInt(settings.embedColor.slice(1), 16),
        );
    case 'nowplaying':
      return nowPlayingEmbed(view.snapshot, settings);
    case 'queue':
      return queueEmbed(view.snapshot, view.page, settings).embed;
    case 'track': {
      artwork(embed, view.track)
        .setTitle(cleanText(view.title, 256))
        .setDescription(trackLabel(view.track));
      const url = view.track.uri && safeWebUrl(view.track.uri);
      if (url) embed.setURL(url);
      return embed.addFields({
        name: t(settings.language, 'duration'),
        value: view.track.isStream ? 'LIVE' : formatTime(view.track.durationMs),
      });
    }
    case 'added': {
      const total = view.tracks.reduce((sum, track) => sum + track.durationMs, 0);
      embed
        .setTitle(t(settings.language, 'added'))
        .setDescription(
          `${text(view.name, 160)}\n${view.count}${view.total === null ? '' : ` / ${view.total}`} · ${view.mode}\n\n${view.tracks
            .slice(0, 5)
            .map((track) => trackLabel(track))
            .join('\n')}${view.background ? `\n\n${t(settings.language, 'importing')}` : ''}`,
        )
        .addFields({
          name: t(settings.language, 'duration'),
          value: `${formatTime(total)}${view.background ? ' (first additions)' : ''}`,
        });
      if (view.tracks[0]) artwork(embed, view.tracks[0]);
      return embed;
    }
    case 'tracks':
    case 'list': {
      const { page } = view;
      const start = (page.page - 1) * page.pageSize;
      return embed
        .setTitle(cleanText(view.title, 256))
        .setDescription(
          page.items
            .map(
              (item, i) =>
                `**${start + i + 1}.** ${typeof item === 'string' ? text(item, 260) : trackLabel(item)}`,
            )
            .join('\n') || t(settings.language, 'empty'),
        )
        .setAuthor({
          name: t(settings.language, 'page', {
            page: page.page,
            pages: Math.max(1, page.totalPages),
          }),
        });
    }
    case 'search':
      return embed.setTitle(t(settings.language, 'search')).setDescription(
        `${view.items
          .slice(0, 10)
          .map(
            (item, i) =>
              `**${i + 1}.** ${trackLabel(item.track)} · ${formatTime(item.track.durationMs)}`,
          )
          .join('\n')}\n\n${t(settings.language, 'searchHint')}`,
      );
    case 'lyrics':
      return embed
        .setTitle(`${t(settings.language, 'lyrics')} · ${cleanText(view.track.title, 180)}`)
        .setDescription(view.lyrics.text.slice(0, 3200));
    case 'help':
      return embed
        .setTitle(`${t(settings.language, 'help')} · ${t(settings.language, view.selected)}`)
        .setDescription(
          view.entries
            .filter((entry) => entry.category === view.selected)
            .map(
              (entry) =>
                `**/${entry.name}** · ${text(entry.description, 100)}\n\`${cleanText(entry.usage, 150).replaceAll('`', '')}\``,
            )
            .join('\n\n') || '—',
        );
    case 'settings':
      return embed.setTitle(t(settings.language, 'settings')).setDescription(
        Object.entries(view.values)
          .map(([key, value]) => `**${text(key, 80)}:** ${text(value, 200)}`)
          .join('\n') || '—',
      );
    case 'stats':
      return embed.setTitle(t(settings.language, 'stats')).addFields(
        { name: 'Uptime', value: formatTime(view.uptimeMs), inline: true },
        { name: 'Servers / players', value: `${view.guilds} / ${view.players}`, inline: true },
        {
          name: 'Gateway',
          value: view.gatewayPingMs === null ? '—' : `${view.gatewayPingMs} ms`,
          inline: true,
        },
        {
          name: 'Memory (RSS / heap)',
          value: `${Math.round(view.rssBytes / 1048576)} / ${Math.round(view.heapBytes / 1048576)} MiB`,
          inline: true,
        },
        { name: 'Shards', value: view.shards.join(', ') || '0', inline: true },
      );
  }
}
