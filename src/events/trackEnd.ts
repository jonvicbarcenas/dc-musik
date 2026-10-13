import type { BotEvents } from './types.js';
import type { QueueSnapshot } from '../lib/db/models.js';
export function installTrackEnd(bot: BotEvents): () => void {
  const listener = (snapshot: QueueSnapshot) => {
    void bot.tasks.run(() => bot.ui.end(snapshot.guildId, snapshot.currentPlaybackId), 'trackEnd');
  };
  bot.services.players.on('trackEnd', listener);
  return () => {
    bot.services.players.off('trackEnd', listener);
  };
}
