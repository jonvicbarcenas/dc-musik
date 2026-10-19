import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { Dashboard } from '../src/lib/web/Dashboard.js';
import { openDatabase, applyMigrations, createRepositories } from '../src/lib/db/index.js';
import type { DatabaseConnection, Repositories } from '../src/lib/db/index.js';
import type { PlaylistDetail, StoredTrack } from '../src/lib/db/models.js';
import { parseEnv } from '../src/config/env.js';
import { liveFixture, target } from './fixtures/live.js';
import type { LiveView } from '../src/lib/web/LiveQueue.js';

const owner = '123456789012345678';
const other = '223456789012345678';
const track: StoredTrack = {
  version: 1,
  key: 'youtube:abcdefghijk',
  title: 'A song <script>',
  artist: 'Artist',
  source: 'youtube',
  identifier: 'abcdefghijk',
  uri: 'https://www.youtube.com/watch?v=abcdefghijk',
  durationMs: 180000,
  isStream: false,
  artworkUrl: null,
  isrc: null,
  album: null,
  localFileId: null,
};
async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe('playlist dashboard', () => {
  let connection: DatabaseConnection;
  let repositories: Repositories;
  let dashboard: Dashboard;
  let server: Server;
  let origin: string;
  let userId: string;
  let fixture: Awaited<ReturnType<typeof liveFixture>>;
  const search = vi.fn(() => Promise.resolve([{ track, playable: null }]));
  const discordFetch = vi.fn<typeof fetch>((input) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          (typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
          ).includes('/oauth2/token')
            ? { access_token: 'private-oauth-token' }
            : { id: userId, username: 'Listener', global_name: 'Music fan' },
        ),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );

  beforeEach(async () => {
    userId = owner;
    search.mockClear();
    discordFetch.mockClear();
    connection = openDatabase(':memory:');
    applyMigrations(connection);
    repositories = createRepositories(connection);
    fixture = await liveFixture(repositories);
    server = createServer((request, response) => {
      void dashboard.handle(request, response);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test listener');
    origin = `http://127.0.0.1:${address.port}`;
    dashboard = new Dashboard({
      clientId: owner,
      clientSecret: 'private-client-secret',
      url: origin,
      repositories,
      resolver: () => ({
        search,
        pages: async function* () {
          await Promise.resolve();
          yield { name: 'Import', items: [{ track, playable: null }], total: 1 };
        },
      }),
      importLimit: 2000,
      fetch: discordFetch,
      live: fixture.live,
    });
  });
  afterEach(async () => {
    await dashboard.close();
    await fixture.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    connection.close();
  });
  async function signIn() {
    const login = await fetch(`${origin}/auth/login`, { redirect: 'manual' });
    const url = new URL(login.headers.get('location') ?? '');
    const cookie = login.headers.getSetCookie()[0]?.split(';')[0] ?? '';
    const callback = await fetch(
      `${origin}/auth/callback?code=test-code&state=${url.searchParams.get('state')}`,
      { redirect: 'manual', headers: { Cookie: cookie } },
    );
    expect(callback.status).toBe(302);
    const sessionCookie =
      callback.headers
        .getSetCookie()
        .find((value) => value.startsWith('dms_session='))
        ?.split(';')[0] ?? '';
    const session = await json<{ csrf: string; user: { id: string } }>(
      await fetch(`${origin}/api/session`, { headers: { Cookie: sessionCookie } }),
    );
    return {
      Cookie: sessionCookie,
      'X-CSRF-Token': session.csrf,
      Origin: origin,
      'Content-Type': 'application/json',
    };
  }

  it('serves the real static assets with CSP and keeps anonymous libraries private', async () => {
    const response = await fetch(origin);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(await response.text()).toContain('Music Room');
    expect((await fetch(`${origin}/app.js`)).headers.get('content-type')).toContain('javascript');
    expect((await fetch(`${origin}/api/playlists`)).status).toBe(401);
    expect((await fetch(`${origin}/../.env`)).status).toBe(404);
  });
  it('binds single-use OAuth state to the browser and exposes no OAuth secrets', async () => {
    const login = await fetch(`${origin}/auth/login`, { redirect: 'manual' });
    const url = new URL(login.headers.get('location') ?? '');
    expect(url.searchParams.get('scope')).toBe('identify');
    expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/auth/callback`);
    const state = url.searchParams.get('state');
    expect(
      (await fetch(`${origin}/auth/callback?code=x&state=${state}`, { redirect: 'manual' })).status,
    ).toBe(400);
    expect(discordFetch).not.toHaveBeenCalled();
    const headers = await signIn();
    const session = await (await fetch(`${origin}/api/session`, { headers })).text();
    expect(session).toContain(owner);
    expect(session).not.toContain('private-');
    const cookie = login.headers.getSetCookie()[0]?.split(';')[0] ?? '';
    expect(
      (
        await fetch(`${origin}/auth/callback?code=x&state=${state}`, {
          redirect: 'manual',
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(302);
    expect(
      (
        await fetch(`${origin}/auth/callback?code=x&state=${state}`, {
          redirect: 'manual',
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(400);
  });
  it('rejects expired login states', async () => {
    const login = await fetch(`${origin}/auth/login`, { redirect: 'manual' });
    const url = new URL(login.headers.get('location') ?? '');
    const cookie = login.headers.getSetCookie()[0]?.split(';')[0] ?? '';
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_001);
    expect(
      (
        await fetch(`${origin}/auth/callback?code=x&state=${url.searchParams.get('state')}`, {
          redirect: 'manual',
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(400);
    expect(discordFetch).not.toHaveBeenCalled();
  });
  it('requires a matching origin and CSRF token for writes', async () => {
    const headers = await signIn();
    expect(
      (
        await fetch(`${origin}/api/playlists`, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://attacker.example' },
          body: JSON.stringify({ name: 'Mix' }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${origin}/api/playlists`, {
          method: 'POST',
          headers: { ...headers, 'X-CSRF-Token': '' },
          body: JSON.stringify({ name: 'Mix' }),
        })
      ).status,
    ).toBe(403);
    expect((await repositories.playlists.list(owner)).total).toBe(0);
  });
  it('isolates ownership even when a caller guesses another playlist ID', async () => {
    const foreign = await repositories.playlists.create(other, 'Private mix');
    const headers = await signIn();
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      expect(
        (
          await fetch(`${origin}/api/playlists/${foreign.id}`, {
            method,
            headers,
            ...(method === 'PATCH' ? { body: JSON.stringify({ name: 'Stolen' }) } : {}),
          })
        ).status,
      ).toBe(404);
    }
    expect(
      (
        await fetch(`${origin}/api/playlists/${foreign.id}/import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: track.uri }),
        })
      ).status,
    ).toBe(404);
    expect(
      (await json<{ playlists: unknown[] }>(await fetch(`${origin}/api/playlists`, { headers })))
        .playlists,
    ).toEqual([]);
  });
  it('creates, renames, shares, revokes, and deletes the same Discord library records', async () => {
    const headers = await signIn();
    const created = await json<{ playlist: { id: string } }>(
      await fetch(`${origin}/api/playlists`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'My mix' }),
      }),
    );
    const path = `${origin}/api/playlists/${created.playlist.id}`;
    expect(
      (
        await fetch(path, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ name: 'My new mix' }),
        })
      ).status,
    ).toBe(200);
    await fetch(`${path}/share`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled: true }),
    });
    const shared = await repositories.playlists.findOwned(owner, created.playlist.id);
    expect(shared?.name).toBe('My new mix');
    expect(shared?.shareToken).toHaveLength(32);
    await fetch(`${path}/share`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled: false }),
    });
    await expect(repositories.playlists.viewShared(shared?.shareToken ?? '')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
    expect((await fetch(path, { method: 'DELETE', headers })).status).toBe(200);
    expect(await repositories.playlists.findOwned(owner, created.playlist.id)).toBeNull();
  });
  it('only accepts search selections issued to the current session', async () => {
    const playlist = await repositories.playlists.create(owner, 'Mix');
    const headers = await signIn();
    const result = await json<{ results: { id: string }[] }>(
      await fetch(`${origin}/api/search?q=song`, { headers }),
    );
    expect(search).toHaveBeenCalledWith('ytsearch:song', 10, undefined, expect.any(AbortSignal));
    const resultId = result.results[0]?.id;
    const secondSession = await signIn();
    expect(
      (
        await fetch(`${origin}/api/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          headers: secondSession,
          body: JSON.stringify({ resultId }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${origin}/api/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ resultId }),
        })
      ).status,
    ).toBe(200);
    expect(await repositories.playlists.tracksOwned(owner, playlist.id)).toEqual([track]);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_001);
    expect(
      (
        await fetch(`${origin}/api/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ resultId }),
        })
      ).status,
    ).toBe(400);
  });
  it('reorders duplicate songs by entry ID and preserves entry identities', async () => {
    const playlist = await repositories.playlists.create(owner, 'Mix');
    await repositories.playlists.append(owner, playlist.id, [
      track,
      track,
      { ...track, key: 'youtube:other', title: 'Another song' },
    ]);
    const detail = await repositories.playlists.detailOwned(owner, playlist.id);
    const ids = detail.tracks.map((entry) => entry.id);
    const orderedIds = [ids[2], ids[0], ids[1]];
    const headers = await signIn();
    expect(
      (
        await fetch(`${origin}/api/playlists/${playlist.id}/tracks`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ expectedIds: ids, orderedIds }),
        })
      ).status,
    ).toBe(200);
    const after = await json<PlaylistDetail>(
      await fetch(`${origin}/api/playlists/${playlist.id}`, { headers }),
    );
    expect(after.tracks.map((entry) => entry.id)).toEqual(orderedIds);
    expect(after.tracks.map((entry) => entry.position)).toEqual([1, 2, 3]);
    expect(after.tracks[0]?.addedAt).toBe(detail.tracks[2]?.addedAt);
  });
  it('rejects stale tracklists after a Discord append without losing songs', async () => {
    const playlist = await repositories.playlists.create(owner, 'Mix');
    await repositories.playlists.append(owner, playlist.id, [track]);
    const detail = await repositories.playlists.detailOwned(owner, playlist.id);
    await repositories.playlists.append(owner, playlist.id, [track]);
    const headers = await signIn();
    expect(
      (
        await fetch(`${origin}/api/playlists/${playlist.id}/tracks`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            expectedIds: detail.tracks.map((entry) => entry.id),
            orderedIds: [],
          }),
        })
      ).status,
    ).toBe(409);
    expect(await repositories.playlists.tracksOwned(owner, playlist.id)).toHaveLength(2);
  });
  it('rejects duplicate IDs and foreign entries atomically', async () => {
    const playlist = await repositories.playlists.create(owner, 'Mix');
    await repositories.playlists.append(owner, playlist.id, [track, track]);
    const detail = await repositories.playlists.detailOwned(owner, playlist.id);
    const ids = detail.tracks.map((entry) => entry.id);
    await expect(
      repositories.playlists.updateTracks(owner, playlist.id, ids, [ids[0] ?? '', ids[0] ?? '']),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      repositories.playlists.updateTracks(owner, playlist.id, ids, [
        '00000000-0000-4000-8000-000000000000',
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(
      (await repositories.playlists.detailOwned(owner, playlist.id)).tracks.map(
        (entry) => entry.id,
      ),
    ).toEqual(ids);
    await repositories.playlists.updateTracks(owner, playlist.id, ids, []);
    expect(await repositories.playlists.tracksOwned(owner, playlist.id)).toEqual([]);
  });
  it('imports allowed source links and rejects internal and unsupported URLs', async () => {
    const playlist = await repositories.playlists.create(owner, 'Mix');
    const headers = await signIn();
    for (const url of [
      'http://127.0.0.1/admin',
      'https://internal.example/file',
      'https://secret@youtube.com/watch?v=abcdefghijk',
    ]) {
      expect(
        (
          await fetch(`${origin}/api/playlists/${playlist.id}/import`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ url }),
          })
        ).status,
      ).toBe(400);
    }
    const response = await fetch(`${origin}/api/playlists/${playlist.id}/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: track.uri }),
    });
    expect(await json(response)).toEqual({ added: 1 });
    expect(await repositories.playlists.tracksOwned(owner, playlist.id)).toEqual([track]);
  });
  it('enforces normalized unique names on rename', async () => {
    const playlist = await repositories.playlists.create(owner, 'First');
    await repositories.playlists.create(owner, 'Second mix');
    await expect(
      repositories.playlists.rename(owner, playlist.id, 'SECOND   MIX'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repositories.playlists.findOwned(owner, playlist.id))?.name).toBe('First');
  });
  it('invalidates the server session on logout', async () => {
    const headers = await signIn();
    expect(
      (await fetch(`${origin}/api/logout`, { method: 'POST', headers, body: '{}' })).status,
    ).toBe(200);
    expect((await fetch(`${origin}/api/playlists`, { headers })).status).toBe(401);
  });
  it('routes live queue edits and playback controls to the current Discord player', async () => {
    const headers = await signIn();
    const sessions = await json<{ sessions: { id: string }[] }>(
      await fetch(`${origin}/api/live`, { headers }),
    );
    expect(sessions.sessions.map((session) => session.id)).toEqual([target]);
    const path = `${origin}/api/live/${target}`;
    const before = await json<LiveView>(await fetch(path, { headers }));
    const expectedIds = before.upcoming.map((entry) => entry.id);
    expect(
      (
        await fetch(`${path}/tracks`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ expectedIds, orderedIds: expectedIds.slice().reverse() }),
        })
      ).status,
    ).toBe(200);
    const paused = await fetch(`${path}/actions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'pause', paused: true, playbackId: before.playbackId }),
    });
    expect(paused.status).toBe(200);
    const after = await json<LiveView>(await fetch(path, { headers }));
    expect(after.paused).toBe(true);
    expect(after.current?.id).toBe(before.current?.id);
    expect(after.upcoming.map((entry) => entry.id)).toEqual(expectedIds.slice().reverse());
    expect(
      (
        await fetch(`${path}/actions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'volume', volume: 201 }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${path}/actions`, {
          method: 'POST',
          headers: { ...headers, Origin: 'https://attacker.example' },
          body: JSON.stringify({ action: 'volume', volume: 30 }),
        })
      ).status,
    ).toBe(403);
  });
  it('adds search results, owned playlists and imports to live playback and saves the session', async () => {
    const headers = await signIn();
    const path = `${origin}/api/live/${target}`;
    const results = await json<{ results: { id: string }[] }>(
      await fetch(`${origin}/api/search?q=song`, { headers }),
    );
    expect(
      (
        await fetch(`${path}/tracks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ resultId: results.results[0]?.id }),
        })
      ).status,
    ).toBe(200);
    const playlist = await repositories.playlists.create(owner, 'To queue');
    await repositories.playlists.append(owner, playlist.id, [track]);
    expect(
      (
        await fetch(`${path}/playlist`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ playlistId: playlist.id }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${path}/import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: track.uri }),
        })
      ).status,
    ).toBe(200);
    const view = await json<LiveView>(await fetch(path, { headers }));
    expect(view.upcoming).toHaveLength(6);
    const saved = await json<{ playlist: { id: string } }>(
      await fetch(`${path}/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Saved session', includeCurrent: true }),
      }),
    );
    expect(await repositories.playlists.tracksOwned(owner, saved.playlist.id)).toHaveLength(7);
    expect(JSON.stringify(view)).not.toContain('test-encoding');
    const foreign = await repositories.playlists.create(other, 'Someone else');
    expect(
      (
        await fetch(`${path}/playlist`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ playlistId: foreign.id }),
        })
      ).status,
    ).toBe(404);
  });
  it('refreshes live permission errors and returns conflict status for a stale queue', async () => {
    const headers = await signIn();
    const path = `${origin}/api/live/${target}`;
    expect(
      (
        await fetch(`${path}/tracks`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ expectedIds: [], orderedIds: [] }),
        })
      ).status,
    ).toBe(409);
    fixture.presence.present = false;
    expect((await fetch(path, { headers })).status).toBe(403);
    expect(
      (
        await fetch(`${path}/actions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'volume', volume: 30 }),
        })
      ).status,
    ).toBe(403);
  });
});

describe('dashboard configuration', () => {
  const base = {
    DISCORD_TOKEN: `${'a'.repeat(25)}.${'b'.repeat(8)}.${'c'.repeat(30)}`,
    DISCORD_CLIENT_ID: owner,
    LAVALINK_PASSWORD: 'a-valid-lavalink-password',
  };
  it('accepts HTTPS and local HTTP origins', () => {
    expect(parseEnv({ ...base, DASHBOARD_URL: 'https://music.example.com' }).DASHBOARD_URL).toBe(
      'https://music.example.com',
    );
    expect(parseEnv(base).DASHBOARD_URL).toBe('http://localhost:3000');
  });
  it('rejects public HTTP, credentials, and paths', () => {
    for (const url of [
      'http://music.example.com',
      'https://user:pass@music.example.com',
      'https://music.example.com/dashboard',
    ])
      expect(() => parseEnv({ ...base, DASHBOARD_URL: url })).toThrow();
  });
});
