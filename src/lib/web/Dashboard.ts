import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { Repositories } from '../db/contracts.js';
import { playlistNameSchema, snowflakeSchema } from '../db/models.js';
import type { StoredTrack } from '../db/models.js';
import { RepositoryError } from '../db/validation.js';
import type { SourceResolver } from '../music/SourceResolver.js';
import { collectCatalog } from '../music/ImportScheduler.js';
import { MusicError } from '../utils/errors.js';
import { Semaphore } from '../utils/AsyncLock.js';

const userSchema = z.object({
  id: snowflakeSchema,
  username: z.string().max(100),
  global_name: z.string().max(100).nullable().optional(),
});
interface Session {
  user: { id: string; name: string };
  csrf: string;
  expires: number;
  results: Map<string, { track: StoredTrack; expires: number }>;
  requests: number;
  expensive: number;
  window: number;
}
export interface DashboardOptions {
  clientId: string;
  clientSecret?: string | undefined;
  url: string;
  repositories: Repositories;
  resolver: () => Pick<SourceResolver, 'search' | 'pages'> | undefined;
  importLimit: number;
  fetch?: typeof fetch;
}
class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Same-origin, Discord-authenticated editor for the bot's existing personal library. */
export class Dashboard {
  private readonly sessions = new Map<string, Session>();
  private readonly states = new Map<string, number>();
  private readonly loginLimits = new Map<string, { count: number; expires: number }>();
  private readonly work = new Semaphore(2);
  private readonly cancellation = new AbortController();
  private readonly pending = new Set<Promise<void>>();
  private readonly origin: string;
  private readonly assets: Map<string, { body: Buffer; type: string }>;

  constructor(private readonly options: DashboardOptions) {
    this.origin = new URL(options.url).origin;
    this.assets = new Map([
      [
        '/',
        {
          body: readFileSync(new URL('./dashboard/index.html', import.meta.url)),
          type: 'text/html; charset=utf-8',
        },
      ],
      [
        '/app.js',
        {
          body: readFileSync(new URL('./dashboard/app.js', import.meta.url)),
          type: 'text/javascript; charset=utf-8',
        },
      ],
      [
        '/style.css',
        {
          body: readFileSync(new URL('./dashboard/style.css', import.meta.url)),
          type: 'text/css; charset=utf-8',
        },
      ],
      [
        '/favicon.svg',
        {
          body: readFileSync(new URL('./dashboard/favicon.svg', import.meta.url)),
          type: 'image/svg+xml',
        },
      ],
    ]);
  }

  handle = (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const task = this.route(request, response).catch((error: unknown) => {
      if (response.destroyed || response.writableEnded) return;
      let status = 500;
      let message = 'The request could not be completed. Please try again.';
      if (error instanceof HttpError) {
        status = error.status;
        message = error.message;
      } else if (error instanceof z.ZodError) {
        status = 400;
        message = 'Check the submitted values and try again.';
      } else if (error instanceof RepositoryError && error.code !== 'CORRUPT_DATA') {
        status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;
        message = error.message;
      } else if (error instanceof MusicError) {
        status = 400;
        message = error.message;
      }
      this.json(response, status, { error: message });
    });
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
    return task;
  };

  async close(): Promise<void> {
    this.cancellation.abort();
    this.sessions.clear();
    this.states.clear();
    await Promise.allSettled([...this.pending]);
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    if (this.cancellation.signal.aborted) throw new HttpError(503, 'The dashboard is restarting.');
    this.prune();
    const url = new URL(request.url ?? '/', this.origin);
    const path = url.pathname;
    const method = request.method ?? 'GET';
    const asset = this.assets.get(path);
    if (asset && (method === 'GET' || method === 'HEAD')) {
      response
        .writeHead(200, { 'Content-Type': asset.type })
        .end(method === 'HEAD' ? undefined : asset.body);
      return;
    }
    if (method === 'GET' && path === '/auth/login') {
      if (!this.options.clientSecret)
        throw new HttpError(503, 'Discord sign-in has not been configured yet.');
      this.limitLogin(request);
      if (this.states.size >= 500) throw new HttpError(429, 'Please try signing in again later.');
      const state = randomBytes(32).toString('base64url');
      this.states.set(state, Date.now() + 600_000);
      const auth = new URL('https://discord.com/oauth2/authorize');
      auth.search = new URLSearchParams({
        client_id: this.options.clientId,
        response_type: 'code',
        scope: 'identify',
        redirect_uri: `${this.origin}/auth/callback`,
        state,
      }).toString();
      response.setHeader('Set-Cookie', this.cookie('dms_oauth', state, 600));
      response.writeHead(302, { Location: auth.href }).end();
      return;
    }
    if (method === 'GET' && path === '/auth/callback') {
      this.limitLogin(request);
      const state = url.searchParams.get('state');
      if (!state || this.readCookie(request, 'dms_oauth') !== state || !this.states.delete(state))
        throw new HttpError(400, 'Sign-in expired. Return to the dashboard and try again.');
      response.setHeader('Set-Cookie', this.cookie('dms_oauth', '', 0));
      const code = url.searchParams.get('code');
      if (!code || code.length > 2048 || !this.options.clientSecret)
        throw new HttpError(400, 'Sign-in was cancelled. Return to the dashboard to try again.');
      const signal = AbortSignal.any([this.cancellation.signal, AbortSignal.timeout(15_000)]);
      const http = this.options.fetch ?? fetch;
      const tokenResponse = await http('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${this.origin}/auth/callback`,
        }),
      });
      if (!tokenResponse.ok)
        throw new HttpError(502, 'Discord could not complete sign-in. Please try again.');
      const token = z
        .object({ access_token: z.string().min(1).max(4096) })
        .parse(await tokenResponse.json());
      const userResponse = await http('https://discord.com/api/v10/users/@me', {
        signal,
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!userResponse.ok) throw new HttpError(502, 'Discord could not verify your account.');
      const user = userSchema.parse(await userResponse.json());
      if (this.sessions.size >= 1000)
        throw new HttpError(503, 'Please try signing in again later.');
      const previous = this.readCookie(request, 'dms_session');
      if (previous) this.sessions.delete(previous);
      const sessionId = randomBytes(32).toString('base64url');
      this.sessions.set(sessionId, {
        user: { id: user.id, name: user.global_name ?? user.username },
        csrf: randomBytes(32).toString('base64url'),
        expires: Date.now() + 28_800_000,
        results: new Map(),
        requests: 0,
        expensive: 0,
        window: Date.now(),
      });
      response.setHeader('Set-Cookie', [
        this.cookie('dms_oauth', '', 0),
        this.cookie('dms_session', sessionId, 28_800),
      ]);
      response.writeHead(302, { Location: '/' }).end();
      return;
    }
    const sessionId = this.readCookie(request, 'dms_session');
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (method === 'GET' && path === '/api/session') {
      this.json(response, 200, {
        configured: Boolean(this.options.clientSecret),
        user: session?.user ?? null,
        csrf: session?.csrf ?? null,
        searchAvailable: Boolean(this.options.resolver()),
      });
      return;
    }
    if (!path.startsWith('/api/')) throw new HttpError(404, 'Page not found.');
    if (!session) throw new HttpError(401, 'Sign in with Discord to access your library.');
    if (Date.now() - session.window >= 60_000) {
      session.window = Date.now();
      session.requests = 0;
      session.expensive = 0;
    }
    if (++session.requests > 180)
      throw new HttpError(429, 'Too many requests. Please wait a minute.');
    if (method !== 'GET') {
      if (
        request.headers.origin !== this.origin ||
        request.headers['x-csrf-token'] !== session.csrf
      )
        throw new HttpError(403, 'Refresh the page before making changes.');
    }
    const owner = session.user.id;
    const repository = this.options.repositories.playlists;
    if (method === 'POST' && path === '/api/logout') {
      if (sessionId) this.sessions.delete(sessionId);
      response.setHeader('Set-Cookie', this.cookie('dms_session', '', 0));
      this.json(response, 200, { ok: true });
      return;
    }
    if (path === '/api/playlists' && method === 'GET') {
      const items = [];
      for (let page = 1; ; page++) {
        const result = await repository.list(owner, { page, pageSize: 100 });
        items.push(...result.items);
        if (page >= result.totalPages) break;
      }
      this.json(response, 200, { playlists: items });
      return;
    }
    if (path === '/api/playlists' && method === 'POST') {
      const { name } = z.strictObject({ name: playlistNameSchema }).parse(await this.body(request));
      this.json(response, 201, { playlist: await repository.create(owner, name) });
      return;
    }
    if (path === '/api/search' && method === 'GET') {
      this.expensive(session);
      const query = z.string().trim().min(1).max(300).parse(url.searchParams.get('q'));
      const source = z
        .enum(['ytsearch', 'scsearch'])
        .parse(url.searchParams.get('source') ?? 'ytsearch');
      const items = await this.work.run(
        () => this.resolver().search(`${source}:${query}`, 10, undefined, this.signal()),
        this.cancellation.signal,
      );
      const results = items.map(({ track }) => {
        const id = randomUUID();
        session.results.set(id, { track, expires: Date.now() + 600_000 });
        return { id, track };
      });
      while (session.results.size > 50) {
        const first = session.results.keys().next().value;
        if (first) session.results.delete(first);
      }
      this.json(response, 200, { results });
      return;
    }
    const match = /^\/api\/playlists\/([a-f0-9-]+)(?:\/(tracks|import|share))?$/.exec(path);
    if (!match) throw new HttpError(404, 'Endpoint not found.');
    const id = z.uuid().parse(match[1]);
    const action = match[2];
    // Verify ownership before catalog requests and before every edit.
    await repository.detailOwned(owner, id);
    if (!action && method === 'GET') {
      this.json(response, 200, await repository.detailOwned(owner, id));
      return;
    }
    if (!action && method === 'PATCH') {
      const { name } = z.strictObject({ name: playlistNameSchema }).parse(await this.body(request));
      this.json(response, 200, { playlist: await repository.rename(owner, id, name) });
      return;
    }
    if (!action && method === 'DELETE') {
      await repository.delete(owner, id);
      this.json(response, 200, { ok: true });
      return;
    }
    if (action === 'tracks' && method === 'PUT') {
      const ids = z.array(z.uuid()).max(10_000);
      const body = z
        .strictObject({ expectedIds: ids, orderedIds: ids })
        .parse(await this.body(request));
      await repository.updateTracks(owner, id, body.expectedIds, body.orderedIds);
      this.json(response, 200, { ok: true });
      return;
    }
    if (action === 'tracks' && method === 'POST') {
      const { resultId } = z.strictObject({ resultId: z.uuid() }).parse(await this.body(request));
      const result = session.results.get(resultId);
      if (!result || result.expires <= Date.now())
        throw new HttpError(400, 'This search result expired. Search for the song again.');
      await repository.append(owner, id, [result.track]);
      this.json(response, 200, { ok: true });
      return;
    }
    if (action === 'import' && method === 'POST') {
      this.expensive(session);
      const { url: link } = z
        .strictObject({ url: z.url().max(4096) })
        .parse(await this.body(request));
      const parsed = new URL(link);
      if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        ![
          'open.spotify.com',
          'youtube.com',
          'www.youtube.com',
          'music.youtube.com',
          'm.youtube.com',
          'youtu.be',
          'soundcloud.com',
          'www.soundcloud.com',
        ].includes(parsed.hostname)
      )
        throw new HttpError(400, 'Paste a public Spotify, YouTube, or SoundCloud link.');
      const items = await this.work.run(
        () =>
          collectCatalog(
            this.resolver().pages(link, this.options.importLimit, this.signal()),
            this.options.importLimit,
          ),
        this.cancellation.signal,
      );
      if (!items.length) throw new HttpError(400, 'No tracks could be imported from this link.');
      await repository.append(
        owner,
        id,
        items.map((item) => item.track),
      );
      this.json(response, 200, { added: items.length });
      return;
    }
    if (action === 'share' && method === 'POST') {
      const { enabled } = z.strictObject({ enabled: z.boolean() }).parse(await this.body(request));
      this.json(response, 200, { playlist: await repository.setShared(owner, id, enabled) });
      return;
    }
    throw new HttpError(405, 'Method not allowed.');
  }

  private resolver(): Pick<SourceResolver, 'search' | 'pages'> {
    const resolver = this.options.resolver();
    if (!resolver) throw new HttpError(503, 'Music search is starting. Please try again shortly.');
    return resolver;
  }
  private signal(): AbortSignal {
    return AbortSignal.any([this.cancellation.signal, AbortSignal.timeout(90_000)]);
  }
  private expensive(session: Session): void {
    if (++session.expensive > 15)
      throw new HttpError(429, 'Please wait a minute before searching or importing again.');
  }
  private async body(request: IncomingMessage): Promise<unknown> {
    if (!request.headers['content-type']?.startsWith('application/json'))
      throw new HttpError(415, 'Send a JSON request.');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > 1_048_576) throw new HttpError(413, 'This request is too large.');
      chunks.push(bytes);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new HttpError(400, 'The request contains invalid JSON.');
    }
  }
  private json(response: ServerResponse, status: number, value: unknown): void {
    response
      .writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify(value));
  }
  private readCookie(request: IncomingMessage, name: string): string | undefined {
    return request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  }
  private cookie(name: string, value: string, age: number): string {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${this.origin.startsWith('https:') ? '; Secure' : ''}`;
  }
  private limitLogin(request: IncomingMessage): void {
    const key = request.socket.remoteAddress ?? 'unknown';
    const current = this.loginLimits.get(key) ?? { count: 0, expires: Date.now() + 600_000 };
    if (this.loginLimits.size >= 2000 && !this.loginLimits.has(key))
      throw new HttpError(429, 'Please try signing in later.');
    this.loginLimits.set(key, current);
    if (++current.count > 30)
      throw new HttpError(429, 'Please wait before trying to sign in again.');
  }
  private prune(): void {
    const now = Date.now();
    for (const [id, value] of this.sessions) if (value.expires <= now) this.sessions.delete(id);
    for (const [id, expires] of this.states) if (expires <= now) this.states.delete(id);
    for (const [id, value] of this.loginLimits)
      if (value.expires <= now) this.loginLimits.delete(id);
  }
}
