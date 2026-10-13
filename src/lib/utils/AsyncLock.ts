/** FIFO serialization; a failed operation never poisons the next operation. */
export class AsyncLock {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }

  async drain(): Promise<void> {
    await this.tail;
  }
}

/** Shared bound across guilds, not merely a per-playlist concurrency limit. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Invalid capacity.');
  }

  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    if (this.active >= this.capacity)
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    else this.active++;
    try {
      signal?.throwIfAborted();
      return await operation();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }
}
