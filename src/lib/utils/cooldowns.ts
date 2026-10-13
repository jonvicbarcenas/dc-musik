import { CommandError } from '../../framework/errors.js';

export class Cooldowns {
  private readonly until = new Map<string, number>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly maximum = 10_000,
  ) {}
  consume(key: string, milliseconds: number): void {
    const remaining = (this.until.get(key) ?? 0) - this.now();
    if (remaining > 0)
      throw new CommandError(
        'COOLDOWN',
        `Wait ${(remaining / 1000).toFixed(1)} seconds before another command.`,
      );
    if (this.until.size >= this.maximum) {
      for (const [id, expires] of this.until) if (expires <= this.now()) this.until.delete(id);
      while (this.until.size >= this.maximum) {
        const oldest = this.until.keys().next().value;
        if (oldest === undefined) break;
        this.until.delete(oldest);
      }
    }
    this.until.set(key, this.now() + milliseconds);
  }
  clear(): void {
    this.until.clear();
  }
}
