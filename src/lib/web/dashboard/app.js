/* The browser receives display metadata only. Discord OAuth credentials stay on the server. */
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const state = {
  session: null,
  playlists: [],
  current: null,
  selected: new Set(),
  filter: '',
  busy: false,
  results: [],
  searching: false,
  searchMessage: '',
  searchQuery: '',
  source: 'ytsearch',
  request: 0,
  mode: 'library',
  liveSessions: [],
  liveId: null,
  liveError: '',
  refreshing: false,
};
let toastTimer;
let draggedId;
let liveRequest = 0;
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}" /></svg>`;
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const duration = (ms) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const button = (label, name, action, extra = '') =>
  `<button class="btn ${extra}" data-action="${action}">${icon(name)}${label}</button>`;

async function api(path, method = 'GET', body) {
  const headers = {};
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = state.session.csrf;
  }
  const response = await fetch(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      state.session.user = null;
      state.current = null;
      state.liveSessions = [];
      state.playlists = [];
      render();
    }
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
function notice(message, error = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `visible${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => {
    toast.className = '';
  }, 5000);
}
function artwork(track) {
  let url;
  try {
    if (track.artworkUrl && new URL(track.artworkUrl).protocol === 'https:') url = track.artworkUrl;
  } catch {
    /* Use the music icon for invalid artwork. */
  }
  return `<div class="track-cover">${url ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : icon('music')}</div>`;
}
function render() {
  const user = state.session?.user;
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="/" aria-label="Music Room home"><span class="brand-mark">${icon('music')}</span>music room<span class="muted">.</span></a>
      <div class="sidebar-scroll">${user ? `<button class="playlist-link live-nav${state.mode === 'live' ? ' active' : ''}" data-action="live" ${state.mode === 'live' ? 'aria-current="page"' : ''}><span class="dot"></span><span>Live queue</span><small>Discord</small></button>` : ''}<div class="library-top"><span class="sidebar-label">Your library</span><button class="icon-btn" data-action="create" aria-label="Create playlist" ${!user ? 'disabled' : ''}>${icon('plus')}</button></div>
        <nav class="playlist-nav" aria-label="Playlists">${state.playlists.map((playlist) => `<button class="playlist-link${state.mode === 'library' && state.current?.playlist.id === playlist.id ? ' active' : ''}" data-playlist="${playlist.id}" ${state.mode === 'library' && state.current?.playlist.id === playlist.id ? 'aria-current="page"' : ''}>${icon('music')}<span>${esc(playlist.name)}</span></button>`).join('') || `<p class="nav-empty">${user ? 'A fresh start for your next mix.' : 'Your playlists will feel at home here.'}</p>`}</nav>
      </div>
      <div class="sidebar-bottom"><div class="avatar">${esc(user?.name.slice(0, 1).toUpperCase() || 'M')}</div><div class="identity"><strong>${esc(user?.name || 'Your listening space')}</strong>${user ? '<button data-action="logout">Sign out</button>' : '<small>Made for Discord</small>'}</div></div>
    </aside>
    <main class="workspace"><header class="topbar"><div class="crumb">${state.mode === 'live' ? 'Live queue' : 'Library'} <span>/</span><span>${esc(state.current?.playlist.name || 'Your music')}</span></div><span class="connection"><span class="dot"></span>${user ? 'Connected to Discord' : 'Your next session starts here'}</span></header>
      ${!user ? welcome() : state.current ? playlistPage() : state.mode === 'live' ? emptyLive() : emptyLibrary()}
    </main></div>`;
  if (state.current) {
    renderTracks();
    renderResults();
  }
  syncBusy();
}
function welcome() {
  return `<section class="welcome"><div class="eyebrow">A little less typing. A lot more music.</div><div class="cover" aria-hidden="true"><div class="vinyl"></div></div><h1>Your music.<br>Your kind of room.</h1><p>Find a new favorite. Put your playlist in just the right order. Bring it all to your next Discord session.</p>
    ${state.session?.configured ? `<a class="btn primary" href="/auth/login">Connect with Discord ${icon('arrow')}</a><p class="muted"><small>Sign in to open your personal playlist library.</small></p>` : '<div class="setup">Discord sign-in needs a one-time setup. Set <code>DISCORD_CLIENT_SECRET</code> and <code>DASHBOARD_URL</code> on the bot, then register <code>/auth/callback</code> as its OAuth2 redirect. See <code>docs/playlist-dashboard.md</code>.</div>'}
    <div class="feature-strip"><span>${icon('grip')}Drag to reorder</span><span>${icon('search')}Find your next favorite</span><span>${icon('import')}Import your playlists</span></div></section>`;
}
function emptyLibrary() {
  return `<section class="welcome"><div class="eyebrow">Your personal library</div><h1>Good music.<br>Great company.</h1><p>Start with a playlist. Add the songs you keep coming back to, then bring the mix to Discord.</p>${button('Create your first playlist', 'plus', 'create', 'primary')}<div class="feature-strip"><span>${icon('grip')}Drag to reorder</span><span>${icon('search')}Search for songs</span><span>${icon('check')}Saved automatically</span></div></section>`;
}
function emptyLive() {
  return `<section class="welcome"><div class="eyebrow">Your Discord listening session</div><h1>Meet you<br>in voice.</h1><p>${esc(state.liveError || 'Join a Discord voice channel where this music bot is connected, then open the live queue. You can manage the songs playing there from here.')}</p>${button('Find my session', 'refresh', 'live', 'primary')}<div class="feature-strip"><span>${icon('grip')}Reorder upcoming songs</span><span>${icon('play')}Control playback</span><span>${icon('plus')}Add to the live queue</span></div></section>`;
}
function nowPlaying(live) {
  const current = live.current;
  return `<section class="now-playing" aria-label="Now playing"><div class="eyebrow">${live.paused ? 'Paused' : 'Now playing'}</div>${current ? `<div class="now-track">${artwork(current.track)}<div class="track-info"><h2>${esc(current.track.title)}</h2><p>${esc(current.track.artist)} · Requested by ${esc(current.requestedBy)}</p></div></div><div class="playback-progress"><progress max="${Math.max(1, current.track.durationMs)}" value="${live.positionMs}" aria-label="Playback progress"></progress><span id="live-position">${duration(live.positionMs)} / ${current.track.isStream ? 'LIVE' : duration(current.track.durationMs)}</span></div>` : '<p>The player is waiting for its next song.</p>'}<div class="live-controls">${button(live.paused ? 'Resume' : 'Pause', live.paused ? 'play' : 'pause', 'live-pause')}${button(live.permissions.voteSkip ? 'Vote to skip' : 'Skip song', 'next', 'live-skip')}<form id="volume-form"><label for="volume">Volume</label><input id="volume" name="volume" type="number" min="1" max="200" value="${live.volume}" required aria-label="Volume percent"/><button class="btn" type="submit" data-live-control>Set</button></form></div></section>`;
}
function playlistPage() {
  const { playlist, tracks } = state.current;
  const live = state.current.live;
  const minutes = Math.ceil(tracks.reduce((sum, entry) => sum + entry.track.durationMs, 0) / 60000);
  return `<div class="content-grid"><section class="playlist-main" aria-label="Playlist editor">
    ${live ? `<div class="live-session-head"><div class="eyebrow">Listening together · Updates every 5 seconds</div><label for="live-session">Your voice session</label><select id="live-session">${state.liveSessions.map((session) => `<option value="${session.id}" ${session.id === live.id ? 'selected' : ''}>${esc(session.guildName)} / ${esc(session.voiceName)}</option>`).join('')}</select></div>${nowPlaying(live)}${!live.permissions.control ? '<p class="access-note">You can follow the queue. The configured DJ role or Manage Server is needed to edit it.</p>' : ''}${live.pendingImports ? `<p class="access-note">${plural(live.pendingImports, 'import')} still adding songs.</p>` : ''}` : `<div class="hero"><div class="cover" aria-hidden="true"><div class="vinyl"></div></div><div class="hero-copy"><div class="eyebrow">Your playlist · ${playlist.isShared ? 'Shared' : 'Private'}</div><h1>${esc(playlist.name)}</h1><div class="hero-meta"><span>${esc(state.session.user.name)}</span><span>·</span><span>${plural(tracks.length, 'song')}</span><span>·</span><span>${minutes} min${tracks.some((entry) => entry.track.isStream) ? ' + live' : ''}</span></div></div></div>`}
    <div class="actions">${button('Add songs', 'plus', 'find', 'primary')}${live ? button('Add saved playlist', 'music', 'queue-playlist') : button('Play in Discord', 'play', 'play')}${button('Import link', 'import', 'import')}<button class="icon-btn" data-action="shuffle" aria-label="Shuffle playlist" title="Shuffle playlist">${icon('shuffle')}</button>${!live ? `<button class="icon-btn" data-action="share" aria-label="Share playlist" title="Share playlist">${icon('share')}</button>` : ''}<button class="icon-btn" data-action="refresh" aria-label="Refresh playlist" title="Refresh playlist">${icon('refresh')}</button></div>
    <div class="section-head"><h2>${live ? 'Up next' : 'The tracklist'} <small id="track-count">${tracks.length}</small></h2><label class="filter-box">${icon('search')}<span class="sr-only">Filter songs in this playlist</span><input id="filter" type="search" placeholder="Filter ${live ? 'the queue' : 'this playlist'}" value="${esc(state.filter)}" /></label></div>
    <div id="selection"></div><div id="tracks" class="track-list" aria-label="Playlist tracks"></div>
    <p class="list-note">${icon('check')}<span id="save-status">All changes saved · Drag the handle or use the arrow buttons to reorder.</span></p>
    <div class="secondary-actions">${live ? '<button class="text-btn" data-action="live-undo">Undo queue edit</button><button class="text-btn" data-action="save-queue">Save as playlist</button><button class="text-btn" data-action="clear-queue">Clear upcoming songs</button>' : '<button class="text-btn" data-action="rename">Rename playlist</button>'}<button class="text-btn" data-action="dedupe">Remove duplicates</button><button class="text-btn" data-action="export">Export JSON</button>${!live ? '<button class="text-btn" data-action="delete">Delete playlist</button>' : ''}</div>
    </section>
    <aside class="search-panel" aria-labelledby="search-title"><div class="eyebrow">Keep the good songs coming</div><h2 id="search-title">Find your next favorite</h2><p>Search a title or artist. Add it to your mix.</p>
      <form id="search-form"><label class="search-field">${icon('search')}<span class="sr-only">Search music</span><input id="search" type="search" placeholder="A song, an artist, a feeling…" value="${esc(state.searchQuery)}" maxlength="300" required/><button aria-label="Search">${icon('arrow')}</button></label><div class="source-row"><label for="source">Search on</label><select id="source"><option value="ytsearch" ${state.source === 'ytsearch' ? 'selected' : ''}>YouTube</option><option value="scsearch" ${state.source === 'scsearch' ? 'selected' : ''}>SoundCloud</option></select><span><span class="kbd">Ctrl</span> <span class="kbd">K</span></span></div></form>
      <div id="results" aria-live="polite"></div><button class="import-callout" data-action="import">${icon('import')}<span><strong>Already have a playlist?</strong><small>Bring a Spotify, YouTube or SoundCloud link.</small></span></button>
    </aside></div>`;
}
function renderTracks() {
  if (!state.current) return;
  const tracks = state.current.tracks;
  const visible = tracks.filter(({ track }) =>
    `${track.title} ${track.artist}`.toLowerCase().includes(state.filter.toLowerCase()),
  );
  document.querySelector('#tracks').innerHTML =
    visible
      .map((entry) => {
        const position = tracks.indexOf(entry);
        return `<div class="track-row" data-entry="${entry.id}"><button class="grip" draggable="${!state.busy}" aria-label="Drag ${esc(entry.track.title)} to reorder" tabindex="-1">${icon('grip')}</button><input type="checkbox" data-select="${entry.id}" aria-label="Select ${esc(entry.track.title)}" ${state.selected.has(entry.id) ? 'checked' : ''}/>${artwork(entry.track)}<div class="track-info"><div class="track-title" title="${esc(entry.track.title)}">${esc(entry.track.title)}</div><div class="track-subtitle">${esc(entry.track.artist)} · ${esc(entry.track.source)}</div></div><span class="track-length">${entry.track.isStream ? 'LIVE' : duration(entry.track.durationMs)}</span><div class="track-tools"><button class="icon-btn" data-move="${entry.id}" data-direction="-1" aria-label="Move ${esc(entry.track.title)} up" ${position === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="icon-btn" data-move="${entry.id}" data-direction="1" aria-label="Move ${esc(entry.track.title)} down" ${position === tracks.length - 1 ? 'disabled' : ''}>${icon('down')}</button><button class="icon-btn" data-remove="${entry.id}" aria-label="Remove ${esc(entry.track.title)}">${icon('close')}</button></div></div>`;
      })
      .join('') ||
    `<div class="empty">${icon(state.filter ? 'search' : 'music')}<h2>${state.filter ? 'No songs match that filter' : 'Every good mix starts with one song'}</h2><p>${state.filter ? 'Try a different title or artist.' : 'Search for a song on the right, or import a playlist you already love.'}</p>${!state.filter ? button('Import a playlist', 'import', 'import') : ''}</div>`;
  document.querySelector('#selection').innerHTML = state.selected.size
    ? `<div class="selection-bar"><span>${state.selected.size} selected</span><div><button class="btn danger" data-action="remove-selected">${icon('trash')}Remove selected</button><button class="icon-btn" data-action="deselect" aria-label="Clear selection">${icon('close')}</button></div></div>`
    : '';
  document.querySelector('#track-count').textContent = state.filter
    ? `${visible.length} / ${tracks.length}`
    : tracks.length;
  syncBusy();
}
function renderResults() {
  const target = document.querySelector('#results');
  if (!target) return;
  if (state.searching) {
    target.innerHTML = '<p class="search-status" role="status">Finding songs…</p>';
    return;
  }
  target.innerHTML = state.results.length
    ? `<p class="search-status">${plural(state.results.length, 'result')}</p>${state.results.map((result) => `<div class="search-result">${artwork(result.track)}<div class="track-info"><div class="track-title" title="${esc(result.track.title)}">${esc(result.track.title)}</div><div class="track-subtitle">${esc(result.track.artist)}</div></div><button class="icon-btn" data-add="${result.id}" aria-label="Add ${esc(result.track.title)} to playlist">${icon('plus')}</button></div>`).join('')}`
    : `<div class="search-empty">${icon('search')}<strong>${esc(state.searchMessage || 'A whole world of music')}</strong><p>${state.searchMessage ? 'Try another title or artist.' : 'The soundtrack to your next session is one search away.'}</p></div>`;
  syncBusy();
}
function syncBusy() {
  const live = state.current?.live;
  const controls = new Set([
    'find',
    'import',
    'shuffle',
    'dedupe',
    'queue-playlist',
    'clear-queue',
    'live-undo',
    'live-pause',
    'remove-selected',
  ]);
  for (const element of document.querySelectorAll(
    '[data-action], [data-playlist], [data-add], [data-move], [data-remove], [data-select], [data-live-control]',
  )) {
    if (!element.dataset.wasDisabled) element.dataset.wasDisabled = element.disabled ? 'yes' : 'no';
    const requiresControl =
      controls.has(element.dataset.action) ||
      ['add', 'move', 'remove', 'select'].some((key) => key in element.dataset) ||
      element.hasAttribute('data-live-control');
    element.disabled =
      state.busy ||
      element.dataset.wasDisabled === 'yes' ||
      Boolean(live && requiresControl && !live.permissions.control) ||
      Boolean(
        live &&
        element.dataset.action === 'live-skip' &&
        (!live.permissions.skip || !live.current || !live.playbackId),
      ) ||
      Boolean(
        live && element.dataset.action === 'live-pause' && (!live.current || !live.playbackId),
      );
  }
  const status = document.querySelector('#save-status');
  if (status)
    status.textContent = state.busy
      ? 'Saving your changes…'
      : `${live ? 'Changes apply to Discord immediately' : 'All changes saved'} · Drag the handle or use the arrow buttons to reorder.`;
}
function collectionPath() {
  return state.current.live
    ? `/api/live/${state.current.live.id}`
    : `/api/playlists/${state.current.playlist.id}`;
}
async function refreshLive(poll = false) {
  const request = ++liveRequest;
  const data = await api('/api/live');
  if (request !== liveRequest || state.mode !== 'live' || !state.session?.user) return;
  state.liveSessions = data.sessions;
  const selected = data.sessions.find((item) => item.id === state.liveId) || data.sessions[0];
  if (!selected) {
    state.liveId = null;
    state.current = null;
    render();
    return;
  }
  state.liveId = selected.id;
  try {
    const live = await api(`/api/live/${selected.id}`);
    if (
      request !== liveRequest ||
      state.mode !== 'live' ||
      !state.session?.user ||
      (poll &&
        (state.busy ||
          dialog.open ||
          draggedId ||
          document.activeElement?.matches('input, select')))
    )
      return;
    const previous = state.current?.live;
    state.current = {
      playlist: { id: live.id, name: live.voiceName },
      tracks: live.upcoming,
      live,
    };
    const ids = new Set(live.upcoming.map((entry) => entry.id));
    state.selected = new Set([...state.selected].filter((id) => ids.has(id)));
    if (
      poll &&
      previous &&
      JSON.stringify({ ...previous, positionMs: 0 }) === JSON.stringify({ ...live, positionMs: 0 })
    ) {
      const progress = document.querySelector('.playback-progress progress');
      const position = document.querySelector('#live-position');
      if (progress) progress.value = live.positionMs;
      if (position && live.current)
        position.textContent = `${duration(live.positionMs)} / ${live.current.track.isStream ? 'LIVE' : duration(live.current.track.durationMs)}`;
      return;
    }
    state.liveError = '';
    render();
  } catch (error) {
    if (request !== liveRequest || state.mode !== 'live') return;
    if (error.status !== 403 && error.status !== 404) throw error;
    state.current = null;
    state.liveError = error.message;
    render();
  }
}
async function refresh(id = state.current?.playlist.id) {
  const data = await api('/api/playlists');
  state.playlists = data.playlists;
  if (state.mode === 'live') {
    await refreshLive();
    return;
  }
  const selected = state.playlists.find((playlist) => playlist.id === id) || state.playlists[0];
  state.current = selected ? await api(`/api/playlists/${selected.id}`) : null;
  const ids = new Set(state.current?.tracks.map((entry) => entry.id));
  state.selected = new Set([...state.selected].filter((entry) => ids.has(entry)));
  render();
}
async function mutate(operation, message) {
  if (state.busy) return;
  state.busy = true;
  liveRequest++;
  syncBusy();
  try {
    await operation();
    await refresh();
    if (message) notice(message);
  } catch (error) {
    if ([403, 409, 404].includes(error.status)) await refresh();
    notice(error.message, true);
  } finally {
    state.busy = false;
    syncBusy();
  }
}
async function updateOrder(entries, message = 'Playlist updated') {
  if (state.busy || !state.current) return;
  const path = collectionPath();
  const expectedIds = state.current.tracks.map((entry) => entry.id);
  await mutate(
    () =>
      api(`${path}/tracks`, 'PUT', {
        expectedIds,
        orderedIds: entries.map((entry) => entry.id),
      }),
    message,
  );
}
function openDialog(title, content, submitLabel, onSubmit, danger = false) {
  dialog.innerHTML = `<form id="dialog-form"><div class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Close dialog">${icon('close')}</button></div><div class="dialog-body">${content}</div><p class="dialog-error" id="dialog-error" role="alert"></p><div class="dialog-actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" type="submit">${esc(submitLabel)}</button></div></form>`;
  dialog.showModal();
  dialog.querySelector('#dialog-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = dialog.querySelector('[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    dialog.querySelector('#dialog-error').textContent = '';
    try {
      await onSubmit(new FormData(event.currentTarget));
      dialog.close();
    } catch (error) {
      dialog.querySelector('#dialog-error').textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notice('Copied to clipboard');
  } catch {
    notice('Select and copy the displayed text.');
  }
}
const actions = {
  async live() {
    state.mode = 'live';
    state.filter = '';
    state.selected.clear();
    state.liveError = '';
    await mutate(async () => {});
  },
  async 'live-pause'() {
    const live = state.current.live;
    await mutate(async () => {
      const data = await api(`${collectionPath()}/actions`, 'POST', {
        action: 'pause',
        paused: !live.paused,
        playbackId: live.playbackId,
      });
      notice(data.message);
    });
  },
  async 'live-skip'() {
    const live = state.current.live;
    await mutate(async () => {
      const data = await api(`${collectionPath()}/actions`, 'POST', {
        action: 'skip',
        playbackId: live.playbackId,
      });
      notice(data.message);
    });
  },
  async 'live-undo'() {
    await mutate(async () => {
      const data = await api(`${collectionPath()}/actions`, 'POST', { action: 'undo' });
      notice(data.message);
    });
  },
  'queue-playlist'() {
    if (!state.playlists.length) {
      notice('Create a saved playlist in your library first.');
      return;
    }
    const path = collectionPath();
    openDialog(
      'Add a saved playlist',
      `<p>Append its songs to the live Discord queue.</p><label for="queue-playlist">Your playlist</label><select id="queue-playlist" name="playlist">${state.playlists.map((playlist) => `<option value="${playlist.id}">${esc(playlist.name)}</option>`).join('')}</select>`,
      'Add to queue',
      async (form) => {
        const result = await api(`${path}/playlist`, 'POST', { playlistId: form.get('playlist') });
        await refresh();
        notice(`Queued ${plural(result.added, 'song')}`);
      },
    );
  },
  'save-queue'() {
    const path = collectionPath();
    openDialog(
      'Keep this listening session',
      '<p>Save the current song and upcoming tracks as a new personal playlist.</p><label for="name">Playlist name</label><input id="name" name="name" placeholder="Tonight’s mix" maxlength="64" required autofocus/>',
      'Save playlist',
      async (form) => {
        await api(`${path}/save`, 'POST', { name: form.get('name'), includeCurrent: true });
        await refresh();
        notice('Queue saved to your playlist library');
      },
    );
  },
  'clear-queue'() {
    const entries = state.current.tracks;
    if (!entries.length) return notice('The upcoming queue is already empty');
    openDialog(
      'Clear upcoming songs?',
      `<p>Remove ${plural(entries.length, 'song')} from the upcoming queue. The current song keeps playing.</p>`,
      'Clear upcoming',
      () => updateOrder([], 'Upcoming queue cleared'),
      true,
    );
  },
  find() {
    const search = document.querySelector('#search');
    search?.focus({ preventScroll: true });
    search?.scrollIntoView({ block: 'center' });
  },
  create() {
    if (!state.session.user) return;
    openDialog(
      'Make room for a new mix',
      '<label for="name">Playlist name</label><input id="name" name="name" placeholder="Late night favorites" maxlength="64" required autofocus/>',
      'Create playlist',
      async (form) => {
        const data = await api('/api/playlists', 'POST', { name: form.get('name') });
        state.filter = '';
        state.selected.clear();
        state.mode = 'library';
        await refresh(data.playlist.id);
        notice('Your new playlist is ready');
      },
    );
  },
  rename() {
    const { playlist } = state.current;
    openDialog(
      'A new name for this mix',
      `<label for="name">Playlist name</label><input id="name" name="name" value="${esc(playlist.name)}" maxlength="64" required autofocus/>`,
      'Save name',
      async (form) => {
        await api(`/api/playlists/${playlist.id}`, 'PATCH', { name: form.get('name') });
        await refresh();
        notice('Playlist renamed');
      },
    );
  },
  delete() {
    const { playlist } = state.current;
    openDialog(
      'Delete this playlist?',
      `<p><strong>${esc(playlist.name)}</strong> and its saved tracklist will be removed from your library. This cannot be undone.</p>`,
      'Delete playlist',
      async () => {
        await api(`/api/playlists/${playlist.id}`, 'DELETE');
        state.selected.clear();
        state.filter = '';
        await refresh();
        notice('Playlist deleted');
      },
      true,
    );
  },
  import() {
    const path = collectionPath();
    openDialog(
      'Bring your music along',
      '<p>Paste a public Spotify, YouTube, or SoundCloud song or playlist link. Tracks are appended to this playlist.</p><label for="link">Music link</label><input id="link" name="link" type="url" placeholder="https://open.spotify.com/playlist/…" required autofocus/><small>Large imports can take a little while. Your bot’s import and playlist limits apply.</small>',
      'Import tracks',
      async (form) => {
        const result = await api(`${path}/import`, 'POST', { url: form.get('link') });
        await refresh();
        notice(`Added ${plural(result.added, 'song')}`);
      },
    );
  },
  share() {
    const { playlist } = state.current;
    const token = playlist.shareToken;
    openDialog(
      'Share a little good music',
      `<p>Anyone with the read-only token can view or play this playlist using the Discord bot.</p>${token ? `<label>Read-only share token</label><code>${esc(token)}</code><button class="btn" type="button" data-copy="${esc(token)}">Copy token</button>` : '<p>Create a token to share your playlist. Your library stays editable only by you.</p>'}`,
      token ? 'Revoke sharing' : 'Create share token',
      async () => {
        await api(`/api/playlists/${playlist.id}/share`, 'POST', { enabled: !token });
        await refresh();
        notice(token ? 'Sharing revoked' : 'Sharing enabled — open Share to copy the token');
      },
    );
  },
  play() {
    const command = `/playlists play playlist:${state.current.playlist.id}`;
    openDialog(
      'Bring the mix to Discord',
      `<p>Join a voice channel, then paste this slash command into a text channel where the bot is available. Discord will offer the matching command.</p><code>${esc(command)}</code><p>The bot queues the saved playlist in its current order. Music plays in your Discord voice channel.</p>`,
      'Copy command',
      () => copy(command),
    );
  },
  shuffle() {
    const entries = [...state.current.tracks];
    for (let index = entries.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [entries[index], entries[other]] = [entries[other], entries[index]];
    }
    return updateOrder(entries, 'Playlist shuffled');
  },
  dedupe() {
    const seen = new Set(state.current.live?.current ? [state.current.live.current.track.key] : []);
    const entries = state.current.tracks.filter((entry) => {
      if (seen.has(entry.track.key)) return false;
      seen.add(entry.track.key);
      return true;
    });
    const removed = state.current.tracks.length - entries.length;
    if (!removed) return notice('Your playlist has no duplicates');
    openDialog(
      'Remove duplicate songs?',
      `<p>Keep the first copy of each song and remove ${plural(removed, 'duplicate')} from this playlist.</p>`,
      'Remove duplicates',
      () => updateOrder(entries, `Removed ${plural(removed, 'duplicate')}`),
    );
  },
  'remove-selected'() {
    const entries = state.current.tracks.filter((entry) => !state.selected.has(entry.id));
    openDialog(
      'Remove selected songs?',
      `<p>Remove ${plural(state.selected.size, 'song')} from this playlist?</p>`,
      'Remove songs',
      () => updateOrder(entries, 'Selected songs removed'),
      true,
    );
  },
  deselect() {
    state.selected.clear();
    renderTracks();
  },
  refresh() {
    return mutate(async () => {}, 'Library refreshed');
  },
  export() {
    const data = {
      name: state.current.playlist.name,
      tracks: state.current.tracks.map((entry) => entry.track),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'playlist'}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async logout() {
    await api('/api/logout', 'POST', {});
    state.session.user = null;
    state.playlists = [];
    state.current = null;
    state.liveSessions = [];
    state.liveId = null;
    state.mode = 'library';
    state.results = [];
    render();
  },
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target || target.disabled) return;
  if (target.hasAttribute('data-close')) {
    dialog.close();
    return;
  }
  if (target.dataset.copy) {
    void copy(target.dataset.copy);
    return;
  }
  if (state.busy) return;
  const operation = async () => {
    if (target.dataset.action && actions[target.dataset.action])
      await actions[target.dataset.action]();
    else if (target.dataset.playlist) {
      state.mode = 'library';
      state.filter = '';
      state.selected.clear();
      await mutate(() => refresh(target.dataset.playlist));
    } else if (target.dataset.add) {
      const path = collectionPath();
      await mutate(
        () => api(`${path}/tracks`, 'POST', { resultId: target.dataset.add }),
        state.current.live ? 'Song added to the Discord queue' : 'Song added to your playlist',
      );
    } else if (target.dataset.remove)
      await updateOrder(
        state.current.tracks.filter((entry) => entry.id !== target.dataset.remove),
        'Song removed',
      );
    else if (target.dataset.move) {
      const entries = [...state.current.tracks];
      const index = entries.findIndex((entry) => entry.id === target.dataset.move);
      const next = index + Number(target.dataset.direction);
      if (next < 0 || next >= entries.length) return;
      [entries[index], entries[next]] = [entries[next], entries[index]];
      await updateOrder(entries, 'Song moved');
      document
        .querySelector(
          `[data-move="${target.dataset.move}"][data-direction="${target.dataset.direction}"]`,
        )
        ?.focus();
    }
  };
  void operation().catch((error) => notice(error.message, true));
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'filter') {
    state.filter = event.target.value;
    renderTracks();
  }
  if (event.target.id === 'search') state.searchQuery = event.target.value;
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'live-session') {
    state.liveId = event.target.value;
    state.filter = '';
    state.selected.clear();
    void mutate(async () => {}).catch((error) => notice(error.message, true));
  }
  if (event.target.dataset.select) {
    if (event.target.checked) state.selected.add(event.target.dataset.select);
    else state.selected.delete(event.target.dataset.select);
    renderTracks();
  }
  if (event.target.id === 'source') state.source = event.target.value;
});
document.addEventListener('submit', (event) => {
  if (event.target.id === 'volume-form') {
    event.preventDefault();
    const volume = Number(new FormData(event.target).get('volume'));
    void mutate(async () => {
      const data = await api(`${collectionPath()}/actions`, 'POST', { action: 'volume', volume });
      notice(data.message);
    });
    return;
  }
  if (event.target.id !== 'search-form') return;
  event.preventDefault();
  const query = state.searchQuery.trim();
  if (!query || state.searching) return;
  const request = ++state.request;
  state.searching = true;
  state.searchMessage = '';
  renderResults();
  void api(`/api/search?q=${encodeURIComponent(query)}&source=${state.source}`)
    .then((data) => {
      if (request !== state.request) return;
      state.results = data.results;
      if (!data.results.length) state.searchMessage = 'No songs found this time';
    })
    .catch((error) => {
      state.results = [];
      state.searchMessage = error.message;
      notice(error.message, true);
    })
    .finally(() => {
      state.searching = false;
      renderResults();
    });
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !dialog.open) {
    const search = document.querySelector('#search');
    if (search) {
      event.preventDefault();
      search.focus();
      search.scrollIntoView({ block: 'center' });
    }
  }
});
document.addEventListener('dragstart', (event) => {
  const handle = event.target.closest('.grip');
  if (!handle || state.busy || (state.current?.live && !state.current.live.permissions.control)) {
    event.preventDefault();
    return;
  }
  const row = handle.closest('[data-entry]');
  draggedId = row.dataset.entry;
  event.dataTransfer.setData('text/plain', draggedId);
  event.dataTransfer.effectAllowed = 'move';
  row.classList.add('dragging');
});
document.addEventListener('dragover', (event) => {
  const row = event.target.closest('[data-entry]');
  if (!row || !draggedId || state.busy) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  for (const item of document.querySelectorAll('.drop-target'))
    item.classList.remove('drop-target');
  row.classList.add('drop-target');
});
document.addEventListener('drop', (event) => {
  const row = event.target.closest('[data-entry]');
  if (!row || !draggedId || state.busy) return;
  event.preventDefault();
  const targetId = row.dataset.entry;
  const id = draggedId;
  draggedId = null;
  if (targetId === id) return;
  const entries = [...state.current.tracks];
  const from = entries.findIndex((entry) => entry.id === id);
  const target = entries.findIndex((entry) => entry.id === targetId);
  if (from < 0 || target < 0) return;
  entries.splice(target, 0, ...entries.splice(from, 1));
  void updateOrder(entries, 'Playlist reordered');
});
document.addEventListener('dragend', () => {
  draggedId = null;
  for (const item of document.querySelectorAll('.dragging, .drop-target'))
    item.classList.remove('dragging', 'drop-target');
});
document.addEventListener(
  'error',
  (event) => {
    if (event.target.tagName === 'IMG') event.target.replaceWith(document.createTextNode('♪'));
  },
  true,
);
async function start() {
  try {
    state.session = await api('/api/session');
    if (state.session.user) {
      const data = await api('/api/live');
      state.liveSessions = data.sessions;
      if (data.sessions.length) state.mode = 'live';
      await refresh();
    } else render();
  } catch (error) {
    app.innerHTML = `<div class="boot" role="alert">${esc(error.message)} <a href="/">Try again</a></div>`;
  }
}
void start();
setInterval(() => {
  if (
    !state.session?.user ||
    state.mode !== 'live' ||
    state.busy ||
    state.refreshing ||
    dialog.open ||
    draggedId ||
    document.hidden ||
    document.activeElement?.matches('input, select')
  )
    return;
  state.refreshing = true;
  void refreshLive(true)
    .catch((error) => notice(error.message, true))
    .finally(() => {
      state.refreshing = false;
    });
}, 5000);
