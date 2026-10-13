import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from './SafeHttpClient.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import { MusicError } from '../utils/errors.js';
import { isPreviewRequest } from '../music/PreviewPolicy.js';

const idSchema = z.uuid();
export interface CachedMedia {
  id: string;
  url: string;
  size: number;
}

/** Lavalink sees only immutable, bounded files, never arbitrary user download URLs or manifests. */
export class MediaBridge {
  private server: Server | null = null;
  private key: Buffer | null = null;
  private readonly lock = new AsyncLock();
  private readonly directory: string;
  constructor(
    private readonly env: Pick<
      Env,
      | 'MEDIA_BRIDGE_PORT'
      | 'MEDIA_BRIDGE_BIND'
      | 'MEDIA_BRIDGE_PUBLIC_URL'
      | 'MEDIA_MAX_BYTES'
      | 'MEDIA_REQUEST_TIMEOUT_MS'
    >,
    private readonly http = new SafeHttpClient(),
    directory = './media-cache',
  ) {
    this.directory = resolve(directory);
  }

  /** Shard children load the shared key; only the supervisor binds the HTTP port. */
  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const keyPath = join(this.directory, '.bridge-key');
    try {
      await writeFile(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    this.key = await readFile(keyPath);
    if (this.key.length !== 32) throw new Error('Invalid media bridge key.');
  }
  async start(): Promise<void> {
    if (this.server) return;
    await this.initialize();
    const server = createServer((request, response) => {
      void this.serve(request, response).catch(() => {
        response.destroy();
      });
    });
    server.requestTimeout = 30_000;
    server.headersTimeout = 10_000;
    await new Promise<void>((ready, reject) => {
      server.once('error', reject);
      server.listen(this.env.MEDIA_BRIDGE_PORT, this.env.MEDIA_BRIDGE_BIND, () => {
        server.off('error', reject);
        ready();
      });
    });
    server.on('error', () => {
      /* Socket-level failures must not crash the bot. */
    });
    this.server = server;
  }

  async download(url: string, signal?: AbortSignal): Promise<CachedMedia> {
    return this.lock.run(async () => {
      if (!this.key) throw new Error('Start the media bridge before downloading.');
      const response = await this.http.request(url, {
        maxBytes: this.env.MEDIA_MAX_BYTES,
        timeoutMs: this.env.MEDIA_REQUEST_TIMEOUT_MS,
        ...(signal ? { signal } : {}),
      });
      if (isPreviewRequest('', response.url))
        throw new MusicError(
          'UNAVAILABLE',
          'The download redirected to a preview clip. Use a full song link.',
        );
      if (response.status !== 200 || !isAudioContainer(response.body)) {
        throw new MusicError(
          'UNAVAILABLE',
          'Use a complete MP3, AAC, Ogg, FLAC, WAV, MP4, or WebM audio file.',
        );
      }
      const files = await readdir(this.directory);
      let used = 0;
      for (const file of files.filter((file) => /^[a-f0-9-]{36}\.media$/.test(file))) {
        used += (await stat(join(this.directory, file))).size;
      }
      if (used + response.body.length > this.env.MEDIA_MAX_BYTES * 20) {
        throw new MusicError(
          'MEDIA_TOO_LARGE',
          'The media cache is full. Ask the bot owner to clear unused files.',
        );
      }
      const id = randomUUID();
      await writeFile(this.filePath(id), response.body, { flag: 'wx', mode: 0o600 });
      return { id, url: await this.urlFor(id), size: response.body.length };
    });
  }

  async urlFor(id: string): Promise<string> {
    idSchema.parse(id);
    if (!this.key) throw new Error('Media bridge has not started.');
    try {
      await stat(this.filePath(id));
    } catch {
      throw new MusicError(
        'UNAVAILABLE',
        'This uploaded file is no longer available. Upload it again.',
      );
    }
    const signature = createHmac('sha256', this.key).update(id).digest('hex');
    return `${this.env.MEDIA_BRIDGE_PUBLIC_URL}/media/${id}/${signature}`;
  }

  /** Call with IDs referenced by ALL bot snapshots/favorites/playlists, never just one guild. */
  async pruneUnused(retained: ReadonlySet<string>, olderThanMs = 7 * 86_400_000): Promise<number> {
    return this.lock.run(async () => {
      let removed = 0;
      for (const file of await readdir(this.directory)) {
        const id = file.replace(/\.media$/, '');
        if (!idSchema.safeParse(id).success || retained.has(id)) continue;
        const path = this.filePath(id);
        if ((await stat(path)).mtimeMs > Date.now() - olderThanMs) continue;
        await unlink(path);
        removed++;
      }
      return removed;
    });
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((ready) => server.close(() => ready()));
    }
  }

  private filePath(id: string): string {
    return join(this.directory, `${idSchema.parse(id)}.media`);
  }
  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const match = /^\/media\/([a-f0-9-]{36})\/([a-f0-9]{64})$/.exec(request.url ?? '');
    if (!match || !this.key || !['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(404).end();
      return;
    }
    const id = match[1] ?? '';
    if (!idSchema.safeParse(id).success) {
      response.writeHead(404).end();
      return;
    }
    const expected = createHmac('sha256', this.key).update(id).digest();
    if (!timingSafeEqual(expected, Buffer.from(match[2] ?? '', 'hex'))) {
      response.writeHead(404).end();
      return;
    }
    let size: number;
    try {
      size = (await stat(this.filePath(id))).size;
    } catch {
      response.writeHead(404).end();
      return;
    }
    let start = 0;
    let end = size - 1;
    let status = 200;
    const range = request.headers.range;
    if (range) {
      const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parsed || (!parsed[1] && !parsed[2])) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      if (!parsed[1]) start = Math.max(0, size - Number(parsed[2]));
      else {
        start = Number(parsed[1]);
        end = parsed[2] ? Math.min(Number(parsed[2]), end) : end;
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size
      ) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      status = 206;
    }
    response.writeHead(status, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    await pipeline(createReadStream(this.filePath(id), { start, end }), response);
  }
}

export function isAudioContainer(body: Buffer): boolean {
  if (body.length < 12) return false;
  const header = body.subarray(0, 12);
  const ascii = header.toString('ascii');
  return (
    ascii.startsWith('ID3') ||
    ascii.startsWith('OggS') ||
    ascii.startsWith('fLaC') ||
    (ascii.startsWith('RIFF') && ascii.slice(8) === 'WAVE') ||
    ascii.slice(4, 8) === 'ftyp' ||
    header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ||
    (header[0] === 0xff && ((header[1] ?? 0) & 0xe0) === 0xe0)
  );
}
