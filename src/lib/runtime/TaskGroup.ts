import type { Logger } from 'pino';
import { errorCode } from '../utils/errors.js';

/** EventEmitter callbacks return immediately; their work remains observable and drainable. */
export class TaskGroup {
  private readonly tasks = new Set<Promise<void>>();
  private closing = false;
  constructor(private readonly logger: Logger) {}
  run(operation: () => Promise<unknown>, event: string): Promise<void> {
    if (this.closing) return Promise.resolve();
    const task = Promise.resolve()
      .then(operation)
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.warn({ event, code: errorCode(error) }, 'Event operation deferred or failed.');
      });
    this.tasks.add(task);
    void task.then(() => this.tasks.delete(task));
    return task;
  }
  beginShutdown(): void {
    this.closing = true;
  }
  async drain(): Promise<void> {
    while (this.tasks.size) await Promise.allSettled([...this.tasks]);
  }
}
