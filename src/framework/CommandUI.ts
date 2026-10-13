import type { CommandContext } from './CommandContext.js';
import type { CommandCategory } from './Command.js';
import type { Page, QueueEntry, QueueSnapshot, StoredTrack } from '../lib/db/models.js';
import type { ResolvedItem } from '../lib/music/types.js';
import type { Lyrics } from '../lib/music/LyricsService.js';

export type CommandView =
  | { kind: 'notice'; title: string; text: string; tone?: 'success' | 'info' | 'warning' }
  | { kind: 'nowplaying'; snapshot: QueueSnapshot }
  | { kind: 'track'; title: string; track: StoredTrack; entry?: QueueEntry }
  | {
      kind: 'added';
      tracks: StoredTrack[];
      count: number;
      total: number | null;
      name: string;
      background: boolean;
      mode: 'append' | 'next' | 'now';
    }
  | {
      kind: 'queue';
      snapshot: QueueSnapshot;
      page: number;
      onPage(context: CommandContext, page: number): Promise<CommandView>;
    }
  | {
      kind: 'tracks';
      title: string;
      page: Page<StoredTrack>;
      onPage(context: CommandContext, page: number): Promise<CommandView>;
    }
  | {
      kind: 'list';
      title: string;
      page: Page<string>;
      onPage(context: CommandContext, page: number): Promise<CommandView>;
    }
  | {
      kind: 'search';
      items: ResolvedItem[];
      onSelect(context: CommandContext, index: number): Promise<void>;
    }
  | { kind: 'lyrics'; track: StoredTrack; lyrics: Lyrics }
  | {
      kind: 'help';
      selected: CommandCategory;
      entries: { category: CommandCategory; name: string; description: string; usage: string }[];
    }
  | { kind: 'settings'; values: Record<string, string> }
  | {
      kind: 'stats';
      uptimeMs: number;
      guilds: number;
      players: number;
      shards: number[];
      rssBytes: number;
      heapBytes: number;
      gatewayPingMs: number | null;
    };

/** Phase 6 supplies the embed/component renderer. Command executors already perform all actions.
 * Search/page callbacks receive a NEW context and must recheck their policy before acting. */
export interface CommandUI {
  present(context: CommandContext, view: CommandView): Promise<void>;
}
