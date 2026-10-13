import type { PendingImport } from '../db/models.js';
import type { CatalogPage, ResolvedItem } from './types.js';
import type { SourceResolver } from './SourceResolver.js';
import { Semaphore } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';

export interface ImportHooks {
  /** Atomic append + checkpoint. Return false when the job is cancelled or the queue is full. */
  append(
    jobId: string,
    items: readonly ResolvedItem[],
    processedCount: number,
    name: string,
    total: number | null,
  ): Promise<boolean>;
  complete(jobId: string, failed: boolean, failure?: MusicError): Promise<void>;
}

/** Bounded metadata workers; mirrored audio is prefetched separately for the next five tracks. */
export class ImportScheduler {
  private readonly workers: Semaphore;
  private readonly jobs = new Map<
    string,
    { controller: AbortController; promise: Promise<void> }
  >();
  constructor(
    private readonly resolver: SourceResolver,
    concurrency = 3,
  ) {
    this.workers = new Semaphore(concurrency);
  }
  start(job: PendingImport, hooks: ImportHooks, onFailure: (failure?: MusicError) => void): void {
    if (this.jobs.has(job.id)) return;
    const controller = new AbortController();
    const promise = this.workers
      .run(async () => {
        let processed = 0;
        try {
          for await (const page of this.resolver.pages(job.query, job.limit, controller.signal)) {
            const skip = Math.max(0, job.processedCount - processed);
            processed += page.items.length;
            const items = page.items.slice(skip);
            if (!items.length) continue;
            controller.signal.throwIfAborted();
            if (!(await hooks.append(job.id, items, processed, page.name, page.total))) {
              await hooks.complete(job.id, false);
              return;
            }
          }
          await hooks.complete(job.id, false);
        } catch (error) {
          if (!controller.signal.aborted) {
            const failure = error instanceof MusicError ? error : undefined;
            onFailure(failure);
            await hooks.complete(job.id, true, failure);
          }
        }
      }, controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) onFailure();
      })
      .finally(() => this.jobs.delete(job.id));
    this.jobs.set(job.id, { controller, promise });
  }
  cancel(id: string): void {
    this.jobs.get(id)?.controller.abort();
  }
  async close(): Promise<void> {
    const jobs = [...this.jobs.values()];
    for (const job of jobs) job.controller.abort();
    await Promise.allSettled(jobs.map((job) => job.promise));
  }
}

/** Convenience for personal-playlist import commands; no playback or previews are required. */
export async function collectCatalog(
  pages: AsyncIterable<CatalogPage>,
  maximum: number,
): Promise<ResolvedItem[]> {
  const items: ResolvedItem[] = [];
  for await (const page of pages) {
    items.push(...page.items.slice(0, maximum - items.length));
    if (items.length >= maximum) break;
  }
  return items;
}
