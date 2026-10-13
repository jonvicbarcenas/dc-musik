import { Redis } from 'ioredis';
import type { Logger } from 'pino';

export interface Cache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  close(): Promise<void>;
}

export class MemoryCache implements Cache {
  private readonly entries = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly maximum = 2000) {}
  get(key: string): Promise<unknown> {
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return Promise.resolve(structuredClone(entry.value));
  }
  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.delete(key);
    while (this.entries.size >= this.maximum) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
    this.entries.set(key, {
      value: structuredClone(value),
      expires: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }
}

/** Redis is an optional cache; snapshots remain durable in the repository. */
export class RedisCache implements Cache {
  private readonly redis: Redis;
  private readonly fallback = new MemoryCache();
  constructor(
    url: string,
    private readonly namespace: string,
    logger: Logger,
  ) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      retryStrategy: (attempt) => Math.min(attempt * 1000, 30_000),
    });
    this.redis.on('error', () =>
      logger.warn({ service: 'redis' }, 'Cache unavailable; using memory.'),
    );
    void this.redis.connect().catch(() => undefined);
  }
  async get(key: string): Promise<unknown> {
    try {
      const value = await this.redis.get(`${this.namespace}:${key}`);
      return value === null ? await this.fallback.get(key) : (JSON.parse(value) as unknown);
    } catch {
      return this.fallback.get(key);
    }
  }
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.fallback.set(key, value, ttlSeconds);
    try {
      await this.redis.set(`${this.namespace}:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* A cache outage must not interrupt playback. */
    }
  }
  async delete(key: string): Promise<void> {
    await this.fallback.delete(key);
    try {
      await this.redis.del(`${this.namespace}:${key}`);
    } catch {
      /* Optional cache. */
    }
  }
  async close(): Promise<void> {
    this.redis.disconnect();
    await this.fallback.close();
  }
}
