import type { Logger } from 'pino';

interface PendingEdit {
  latest: (() => Promise<void>) | null;
  running: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
  last: number;
  closed: boolean;
}

/** One serialized edit per message per interval; bursts replace the pending render. */
export class MessageEditor {
  private readonly pending = new Map<string, PendingEdit>();
  constructor(
    private readonly intervalMs: number,
    private readonly logger: Logger,
  ) {}

  request(id: string, edit: () => Promise<void>): void {
    let state = this.pending.get(id);
    if (!state) {
      state = { latest: null, running: null, timer: null, last: Date.now(), closed: false };
      this.pending.set(id, state);
    }
    if (state.closed) return;
    state.latest = edit;
    this.schedule(id, state);
  }
  register(id: string): void {
    if (!this.pending.has(id))
      this.pending.set(id, {
        latest: null,
        running: null,
        timer: null,
        last: Date.now(),
        closed: false,
      });
  }
  private schedule(id: string, state: PendingEdit): void {
    if (state.closed || state.timer || state.running || !state.latest) return;
    state.timer = setTimeout(
      () => {
        state.timer = null;
        const edit = state.latest;
        state.latest = null;
        if (!edit || state.closed) return;
        state.running = edit()
          .catch(() => {
            this.logger.warn({ messageId: id }, 'Controller edit could not be delivered.');
          })
          .finally(() => {
            state.last = Date.now();
            state.running = null;
            this.schedule(id, state);
          });
      },
      Math.max(0, this.intervalMs - (Date.now() - state.last)),
    );
    state.timer.unref();
  }
  async stop(id: string, terminal?: () => Promise<void>): Promise<void> {
    const state = this.pending.get(id);
    if (state) {
      state.closed = true;
      state.latest = null;
      if (state.timer) clearTimeout(state.timer);
      await state.running;
      this.pending.delete(id);
    }
    if (terminal) await terminal().catch(() => undefined);
  }
  async close(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((id) => this.stop(id)));
  }
}
