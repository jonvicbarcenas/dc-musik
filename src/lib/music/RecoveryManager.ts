import type { Logger } from 'pino';
import type { QueueSnapshotsRepository } from '../db/contracts.js';
import type { SnapshotSummary } from '../db/models.js';
import type { PlayerManager } from './PlayerManager.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { errorCode } from '../utils/errors.js';

/** The Discord adapter checks shard ownership, guild membership, voice permissions, and stage readiness. */
export type RecoveryGuard = (snapshot: SnapshotSummary) => Promise<boolean>;
export class RecoveryManager {
  private readonly lock = new AsyncLock();
  private closing = false;
  stop(): void {
    this.closing = true;
  }
  constructor(
    private readonly players: PlayerManager,
    private readonly snapshots: QueueSnapshotsRepository,
    private readonly guard: RecoveryGuard,
    private readonly logger: Logger,
  ) {}
  async restoreAll(): Promise<{ restored: number; deferred: number }> {
    return this.lock.run(async () => {
      let restored = 0;
      let deferred = 0;
      for (const summary of await this.snapshots.list(this.players.botId)) {
        if (this.closing) break;
        if (this.players.view(summary.guildId)) continue;
        try {
          if (!(await this.guard(summary))) {
            deferred++;
            continue;
          }
          const record = await this.snapshots.load(this.players.botId, summary.guildId);
          if (this.closing) break;
          if (!record) continue;
          await this.players.restore(record);
          restored++;
        } catch (error) {
          deferred++;
          this.logger.warn(
            { guildId: summary.guildId, code: errorCode(error) },
            'Saved player recovery deferred.',
          );
        }
      }
      return { restored, deferred };
    });
  }
  /** Use on node-ready and at a bounded retry interval; retained snapshots are never deleted on failure. */
  async retryOffline(): Promise<void> {
    if (this.closing) return;
    for (const id of this.players.offlineNodeIds()) {
      if (this.closing) return;
      await this.players
        .nodeConnected(id, true)
        .catch((error: unknown) =>
          this.logger.warn({ nodeId: id, code: errorCode(error) }, 'Node recovery deferred.'),
        );
    }
    await this.restoreAll();
  }
}
