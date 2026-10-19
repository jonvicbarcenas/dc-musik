import { randomInt, randomUUID } from 'node:crypto';
import { queueEntrySchema } from '../db/models.js';
import type { PlayableTrack, QueueEntry, Requester, StoredTrack } from '../db/models.js';
import { MusicError } from '../utils/errors.js';

export function createQueueEntry(
  track: StoredTrack,
  requester: Requester,
  playable: PlayableTrack | null = null,
): QueueEntry {
  return queueEntrySchema.parse({
    id: randomUUID(),
    track,
    requester,
    playable,
    addedAt: Date.now(),
  });
}

/** One-based user positions; internal storage is private and every outward view is copied. */
export class QueueManager {
  private entries: QueueEntry[];
  private undoState: { entries: QueueEntry[]; expiresAt: number } | null = null;
  constructor(
    entries: readonly QueueEntry[] = [],
    private maximum = 2000,
    private readonly now: () => number = Date.now,
  ) {
    this.entries = entries.map((entry) => queueEntrySchema.parse(entry));
    this.assertCapacity(this.entries.length);
    this.assertUnique(this.entries);
  }
  get size(): number {
    return this.entries.length;
  }
  get remaining(): number {
    return Math.max(0, this.maximum - this.size);
  }
  get totalDurationMs(): number {
    return this.entries.reduce((sum, entry) => sum + entry.track.durationMs, 0);
  }
  view(): QueueEntry[] {
    return structuredClone(this.entries);
  }
  peek(): QueueEntry | null {
    return structuredClone(this.entries[0] ?? null);
  }
  unresolved(limit: number, excluded: ReadonlySet<string>): QueueEntry[] {
    if (limit < 1) return [];
    const candidates: QueueEntry[] = [];
    for (const entry of this.entries) {
      if (!entry.playable && !excluded.has(entry.id)) candidates.push(structuredClone(entry));
      if (candidates.length >= limit) break;
    }
    return candidates;
  }
  setMaximum(maximum: number): void {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 10_000)
      throw new MusicError('INVALID_INPUT', 'Invalid queue limit.');
    this.maximum = maximum; // Existing tracks survive a lowered server limit.
  }

  add(entries: readonly QueueEntry[], position = this.size + 1, undoable = true): void {
    this.position(position, true);
    this.assertCapacity(this.size + entries.length);
    const parsed = entries.map((entry) => queueEntrySchema.parse(entry));
    this.assertUnique([...this.entries, ...parsed]);
    if (undoable) this.remember();
    else this.invalidateUndo();
    this.entries.splice(position - 1, 0, ...parsed);
  }
  take(): QueueEntry | null {
    this.invalidateUndo();
    return this.entries.shift() ?? null;
  }
  remove(positions: readonly number[]): QueueEntry[] {
    const indexes = new Set(
      positions.map((position) => {
        this.position(position);
        return position - 1;
      }),
    );
    if (indexes.size === 0)
      throw new MusicError('INVALID_INPUT', 'Choose at least one queue position.');
    this.remember();
    const removed = this.entries.filter((_, index) => indexes.has(index));
    this.entries = this.entries.filter((_, index) => !indexes.has(index));
    return structuredClone(removed);
  }
  move(from: number, to: number): void {
    this.position(from);
    this.position(to);
    this.remember();
    const entry = this.entries.splice(from - 1, 1)[0];
    if (entry) this.entries.splice(to - 1, 0, entry);
  }
  /** Compare entry identities inside the player's lock, including duplicates and natural advances. */
  edit(expectedIds: readonly string[], orderedIds: readonly string[]): void {
    if (
      expectedIds.length !== this.entries.length ||
      this.entries.some((entry, index) => entry.id !== expectedIds[index])
    )
      throw new MusicError('CONFLICT', 'The live queue changed. Refresh it and try again.');
    if (new Set(orderedIds).size !== orderedIds.length)
      throw new MusicError('INVALID_INPUT', 'A queue entry cannot appear twice.');
    const byId = new Map(this.entries.map((entry) => [entry.id, entry]));
    const entries = orderedIds.map((id) => {
      const entry = byId.get(id);
      if (!entry) throw new MusicError('INVALID_INPUT', 'That song is no longer in this queue.');
      return entry;
    });
    this.remember();
    this.entries = entries;
  }
  swap(first: number, second: number): void {
    this.position(first);
    this.position(second);
    this.remember();
    const a = this.entries[first - 1];
    const b = this.entries[second - 1];
    if (a && b) {
      this.entries[first - 1] = b;
      this.entries[second - 1] = a;
    }
  }
  clear(undoable = true): number {
    if (undoable) this.remember();
    else this.invalidateUndo();
    const count = this.size;
    this.entries = [];
    return count;
  }
  shuffle(random: (upperExclusive: number) => number = randomInt): void {
    this.remember();
    for (let index = this.size - 1; index > 0; index--) {
      const target = random(index + 1);
      if (!Number.isInteger(target) || target < 0 || target > index)
        throw new RangeError('Invalid shuffle random value.');
      const a = this.entries[index];
      const b = this.entries[target];
      if (a && b) {
        this.entries[index] = b;
        this.entries[target] = a;
      }
    }
  }
  dedupe(currentKey?: string): number {
    this.remember();
    const keys = new Set(currentKey ? [currentKey] : []);
    const before = this.size;
    this.entries = this.entries.filter((entry) => {
      if (keys.has(entry.track.key)) return false;
      keys.add(entry.track.key);
      return true;
    });
    return before - this.size;
  }
  undo(): void {
    const state = this.undoState;
    if (!state || state.expiresAt < this.now())
      throw new MusicError('NOT_FOUND', 'There is no recent queue change to undo.');
    this.assertCapacity(state.entries.length);
    this.entries = structuredClone(state.entries);
    this.invalidateUndo();
  }
  updatePlayable(id: string, playable: PlayableTrack): boolean {
    const entry = this.entries.find((entry) => entry.id === id);
    if (!entry) return false;
    entry.playable = queueEntrySchema.shape.playable.parse(playable);
    return true;
  }
  invalidateUndo(): void {
    this.undoState = null;
  }
  private remember(): void {
    this.undoState = { entries: this.view(), expiresAt: this.now() + 20_000 };
  }
  private position(position: number, allowEnd = false): void {
    if (!Number.isInteger(position) || position < 1 || position > this.size + (allowEnd ? 1 : 0))
      throw new MusicError('INVALID_INPUT', 'That queue position does not exist.');
  }
  private assertCapacity(size: number): void {
    if (size > this.maximum)
      throw new MusicError('QUEUE_FULL', 'The server queue limit has been reached.');
  }
  private assertUnique(entries: readonly QueueEntry[]): void {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      throw new MusicError('CONFLICT', 'Queue entry IDs must be unique.');
  }
}

export { parsePositions } from '../utils/positions.js';
