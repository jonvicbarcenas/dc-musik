import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { Env } from '../../config/env.js';
import { SafeHttpClient } from '../security/SafeHttpClient.js';
import { MusicError } from '../utils/errors.js';
import { spotifyTokenValid } from './SpotifyToken.js';

/** One local, state-bound PKCE flow. Only the caller receives the refresh credential. */
export async function authorizeSpotify(
  env: Pick<Env, 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_REDIRECT_URI'>,
  onReady: (url: string) => void,
  save: (refreshToken: string) => Promise<void>,
  http = new SafeHttpClient(),
  timeoutMs = 15 * 60 * 1000,
): Promise<void> {
  if (!env.SPOTIFY_CLIENT_ID)
    throw new MusicError(
      'INVALID_INPUT',
      'Configure SPOTIFY_CLIENT_ID before authorizing Spotify.',
    );
  const redirect = new URL(env.SPOTIFY_REDIRECT_URI);
  if (
    redirect.protocol !== 'http:' ||
    redirect.hostname !== '127.0.0.1' ||
    !redirect.port ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash
  )
    throw new MusicError(
      'INVALID_INPUT',
      'Spotify authorization needs an explicit http://127.0.0.1:PORT/callback address.',
    );
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(64).toString('base64url');
  const authorize = new URL('https://accounts.spotify.com/authorize');
  authorize.search = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirect.href,
    scope: 'playlist-read-private playlist-read-collaborative',
    state,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).toString();
  let resolveFlow!: () => void;
  let rejectFlow!: (error: Error) => void;
  const completed = new Promise<void>((ready, failed) => {
    resolveFlow = ready;
    rejectFlow = failed;
  });
  let accepting = true;
  const abort = new AbortController();
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    let url: URL;
    try {
      url = new URL(request.url ?? '/', redirect.origin);
    } catch {
      response.writeHead(400).end('Invalid callback address.');
      return;
    }
    if (
      request.method !== 'GET' ||
      url.origin !== redirect.origin ||
      url.pathname !== redirect.pathname ||
      request.headers.host !== redirect.host
    ) {
      response.writeHead(404).end('Not found.');
      return;
    }
    const receivedState = url.searchParams.get('state') ?? '';
    const validState =
      url.searchParams.getAll('state').length === 1 &&
      Buffer.byteLength(receivedState) === Buffer.byteLength(state) &&
      timingSafeEqual(Buffer.from(receivedState), Buffer.from(state));
    if (!validState) {
      response
        .writeHead(400)
        .end('Invalid authorization state. Use the sign-in link from the terminal.');
      return;
    }
    if (!accepting) {
      response.writeHead(409).end('Authorization is already being processed.');
      return;
    }
    if (url.searchParams.has('error')) {
      accepting = false;
      response
        .writeHead(400)
        .end('Spotify authorization was declined. You can run the helper again.');
      rejectFlow(
        new MusicError(
          'SPOTIFY_AUTH_REQUIRED',
          'Spotify sign-in was declined. Run npm run spotify:auth when ready.',
        ),
      );
      return;
    }
    const code = url.searchParams.get('code');
    if (
      url.searchParams.getAll('code').length !== 1 ||
      !code ||
      code.length > 4096 ||
      !/^[\x21-\x7e]+$/.test(code)
    ) {
      response.writeHead(400).end('Authorization code missing or invalid.');
      return;
    }
    accepting = false;
    void (async () => {
      try {
        const tokenResponse = await http.request('https://accounts.spotify.com/api/token', {
          method: 'POST',
          allowedOrigin: 'https://accounts.spotify.com',
          redirects: 0,
          maxBytes: 64 * 1024,
          signal: abort.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: env.SPOTIFY_CLIENT_ID!,
            code,
            redirect_uri: redirect.href,
            code_verifier: verifier,
          }).toString(),
        });
        if (tokenResponse.status !== 200)
          throw new MusicError(
            'SPOTIFY_AUTH_REQUIRED',
            'Spotify authorization was rejected. Check the application, redirect URI and approved account, then retry.',
          );
        let body: unknown;
        try {
          body = JSON.parse(tokenResponse.body.toString('utf8')) as unknown;
        } catch {
          throw new MusicError(
            'SPOTIFY_AUTH_REQUIRED',
            'Spotify returned an invalid authorization response. Retry sign-in.',
          );
        }
        const token =
          typeof body === 'object' && body !== null && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : {};
        if (
          !spotifyTokenValid(token['refresh_token']) ||
          typeof token['scope'] !== 'string' ||
          !token['scope'].split(' ').includes('playlist-read-private')
        )
          throw new MusicError(
            'SPOTIFY_AUTH_REQUIRED',
            'Spotify did not grant playlist access. Approve playlist permissions and retry.',
          );
        abort.signal.throwIfAborted();
        await save(token['refresh_token']);
        response
          .writeHead(200)
          .end('Spotify authorization saved. You can close this tab and restart the Discord bot.');
        resolveFlow();
      } catch (error) {
        response
          .writeHead(400)
          .end('Spotify authorization could not be saved. Check the terminal for instructions.');
        rejectFlow(
          error instanceof MusicError
            ? error
            : new MusicError(
                'UNAVAILABLE',
                'Spotify authorization could not be saved. Check that .env is writable and retry.',
              ),
        );
      }
    })();
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    abort.abort();
    rejectFlow(new MusicError('SPOTIFY_AUTH_REQUIRED', 'Spotify authorization was cancelled.'));
  };
  try {
    await new Promise<void>((ready, failed) => {
      server.once('error', () =>
        failed(
          new MusicError(
            'UNAVAILABLE',
            'Spotify callback port is unavailable. Close the other authorization helper, or choose another SPOTIFY_REDIRECT_URI port.',
          ),
        ),
      );
      server.listen(Number(redirect.port), '127.0.0.1', ready);
    });
    timer = setTimeout(() => {
      abort.abort();
      rejectFlow(
        new MusicError(
          'SPOTIFY_AUTH_REQUIRED',
          'Spotify sign-in timed out. Run npm run spotify:auth again.',
        ),
      );
    }, timeoutMs);
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    onReady(authorize.href);
    await completed;
  } finally {
    if (timer) clearTimeout(timer);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    accepting = false;
    await new Promise<void>((ready) => {
      server.close(() => ready());
      server.closeAllConnections();
    });
  }
}
