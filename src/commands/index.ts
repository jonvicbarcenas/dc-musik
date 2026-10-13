import { CommandRegistry } from '../framework/CommandRegistry.js';
import announce from './admin/announce.js';
import autoleave from './admin/autoleave.js';
import blacklist from './admin/blacklist.js';
import clean from './admin/clean.js';
import defaultvolume from './admin/defaultvolume.js';
import djrole from './admin/djrole.js';
import language from './admin/language.js';
import maxqueue from './admin/maxqueue.js';
import maxtracklength from './admin/maxtracklength.js';
import musicchannel from './admin/musicchannel.js';
import prefix from './admin/prefix.js';
import settings from './admin/settings.js';
import sponsorblock from './admin/sponsorblock.js';
import stay from './admin/stay.js';
import voteskip from './admin/voteskip.js';
import bassboost from './audio/bassboost.js';
import eightd from './audio/eightd.js';
import equalizer from './audio/equalizer.js';
import filters from './audio/filters.js';
import karaoke from './audio/karaoke.js';
import lowpass from './audio/lowpass.js';
import nightcore from './audio/nightcore.js';
import pitch from './audio/pitch.js';
import rate from './audio/rate.js';
import rotation from './audio/rotation.js';
import speed from './audio/speed.js';
import tremolo from './audio/tremolo.js';
import vaporwave from './audio/vaporwave.js';
import vibrato from './audio/vibrato.js';
import volume from './audio/volume.js';
import about from './extras/about.js';
import favorites from './extras/favorites.js';
import grab from './extras/grab.js';
import help from './extras/help.js';
import history from './extras/history.js';
import invite from './extras/invite.js';
import lyrics from './extras/lyrics.js';
import ping from './extras/ping.js';
import playlists from './extras/playlists.js';
import stats from './extras/stats.js';
import support from './extras/support.js';
import forward from './playback/forward.js';
import join from './playback/join.js';
import leave from './playback/leave.js';
import pause from './playback/pause.js';
import play from './playback/play.js';
import playnext from './playback/playnext.js';
import playnow from './playback/playnow.js';
import previous from './playback/previous.js';
import replay from './playback/replay.js';
import resume from './playback/resume.js';
import rewind from './playback/rewind.js';
import search from './playback/search.js';
import seek from './playback/seek.js';
import skip from './playback/skip.js';
import skipto from './playback/skipto.js';
import stop from './playback/stop.js';
import autoplay from './queue/autoplay.js';
import clear from './queue/clear.js';
import dedupe from './queue/dedupe.js';
import loop from './queue/loop.js';
import move from './queue/move.js';
import nowplaying from './queue/nowplaying.js';
import queue from './queue/queue.js';
import remove from './queue/remove.js';
import shuffle from './queue/shuffle.js';
import swap from './queue/swap.js';
import undo from './queue/undo.js';

export const commands = [
  announce,
  autoleave,
  blacklist,
  clean,
  defaultvolume,
  djrole,
  language,
  maxqueue,
  maxtracklength,
  musicchannel,
  prefix,
  settings,
  sponsorblock,
  stay,
  voteskip,
  bassboost,
  eightd,
  equalizer,
  filters,
  karaoke,
  lowpass,
  nightcore,
  pitch,
  rate,
  rotation,
  speed,
  tremolo,
  vaporwave,
  vibrato,
  volume,
  about,
  favorites,
  grab,
  help,
  history,
  invite,
  lyrics,
  ping,
  playlists,
  stats,
  support,
  forward,
  join,
  leave,
  pause,
  play,
  playnext,
  playnow,
  previous,
  replay,
  resume,
  rewind,
  search,
  seek,
  skip,
  skipto,
  stop,
  autoplay,
  clear,
  dedupe,
  loop,
  move,
  nowplaying,
  queue,
  remove,
  shuffle,
  swap,
  undo,
] as const;
export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry(commands);
}
