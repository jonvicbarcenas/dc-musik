import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { UrlGuard } from './UrlGuard.js';
import { MusicError } from '../utils/errors.js';

export interface SafeResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  url: string;
}
export interface RequestOptions {
  signal?: AbortSignal;
  maxBytes?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  allowedOrigin?: string;
  redirects?: number;
}

/** Connect to a validated address while preserving Host and TLS SNI. No ambient proxy or cookies. */
export class SafeHttpClient {
  constructor(private readonly guard = new UrlGuard()) {}

  async request(input: string, options: RequestOptions = {}): Promise<SafeResponse> {
    const deadline = Date.now() + (options.timeoutMs ?? 30_000);
    let current = input;
    for (let redirects = 0; redirects <= (options.redirects ?? 4); redirects++) {
      options.signal?.throwIfAborted();
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new MusicError('UNAVAILABLE', 'The source took too long to respond.');
      let dnsTimer: ReturnType<typeof setTimeout> | undefined;
      const validated = await Promise.race([
        this.guard.validate(current),
        new Promise<never>((_, reject) => {
          dnsTimer = setTimeout(
            () => reject(new MusicError('UNAVAILABLE', 'The source took too long to respond.')),
            remaining,
          );
          dnsTimer.unref();
        }),
      ]).finally(() => {
        if (dnsTimer) clearTimeout(dnsTimer);
      });
      const { url, addresses } = validated;
      if (options.allowedOrigin && url.origin !== options.allowedOrigin)
        throw new MusicError('UNSAFE_URL', 'The source redirected outside its permitted service.');
      const address = addresses[0];
      if (!address) throw new MusicError('UNSAFE_URL', 'The destination is unavailable.');
      const response = await new Promise<SafeResponse>((resolve, reject) => {
        const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
        const request = requester(
          url,
          {
            method: options.method ?? 'GET',
            agent: false,
            family: address.family,
            headers: {
              'User-Agent': 'DiscordMusicStream/0.1',
              'Accept-Encoding': 'identity',
              ...options.headers,
            },
            lookup: (_hostname, _lookupOptions, callback) =>
              callback(null, address.address, address.family),
            ...(options.signal ? { signal: options.signal } : {}),
          },
          (incoming) => {
            const status = incoming.statusCode ?? 0;
            if ([301, 302, 303, 307, 308].includes(status)) {
              incoming.destroy();
              resolve({ status, headers: incoming.headers, body: Buffer.alloc(0), url: url.href });
              return;
            }
            const maximum = options.maxBytes ?? 4 * 1024 * 1024;
            const declared = Number(incoming.headers['content-length']);
            if (Number.isFinite(declared) && declared > maximum) {
              incoming.destroy();
              reject(tooLarge());
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            incoming.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > maximum) {
                incoming.destroy();
                reject(tooLarge());
              } else chunks.push(chunk);
            });
            incoming.on('end', () =>
              resolve({
                status,
                headers: incoming.headers,
                body: Buffer.concat(chunks),
                url: url.href,
              }),
            );
            incoming.on('error', () => reject(unavailable()));
            incoming.on('aborted', () => reject(unavailable()));
          },
        );
        const timer = setTimeout(
          () => {
            request.destroy();
            reject(unavailable());
          },
          Math.max(1, deadline - Date.now()),
        );
        timer.unref();
        request.on('close', () => clearTimeout(timer));
        request.on('error', () => reject(unavailable()));
        if (options.body !== undefined) request.write(options.body);
        request.end();
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.location;
      if (!location || (options.method ?? 'GET') !== 'GET') throw unavailable();
      const next = new URL(location, url);
      // User downloads carry no auth. Authenticated service requests cannot change origin.
      if (options.headers?.Authorization && next.origin !== url.origin) throw unavailable();
      current = next.href;
    }
    throw unavailable();
  }

  async json(input: string, options: RequestOptions = {}): Promise<unknown> {
    const response = await this.request(input, options);
    if (response.status < 200 || response.status >= 300) throw unavailable();
    try {
      return JSON.parse(response.body.toString('utf8')) as unknown;
    } catch {
      throw unavailable();
    }
  }
}
function unavailable(): MusicError {
  return new MusicError('UNAVAILABLE', 'The source is unavailable. Please try another link.');
}
function tooLarge(): MusicError {
  return new MusicError('MEDIA_TOO_LARGE', 'This file exceeds the configured download limit.');
}
