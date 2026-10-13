import type { TrackExceptionEvent } from 'lavalink-client';
import type { BotEvents } from './types.js';
import { trackEvent } from '../lib/music/LavalinkTransport.js';
export function forwardTrackError(bot: BotEvents, payload: TrackExceptionEvent): void {
  // Provider exception messages may contain signed URLs. The engine creates the user notice.
  void bot.tasks.run(() => bot.services.players.onTrackEvent(trackEvent(payload)), 'trackError');
}
