import type { TrackStuckEvent } from 'lavalink-client';
import type { BotEvents } from './types.js';
import { trackEvent } from '../lib/music/LavalinkTransport.js';
export function forwardTrackStuck(bot: BotEvents, payload: TrackStuckEvent): void {
  void bot.tasks.run(() => bot.services.players.onTrackEvent(trackEvent(payload)), 'trackStuck');
}
