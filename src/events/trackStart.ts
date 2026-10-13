import type { BotEvents } from './types.js';
import type { QueueSnapshot } from '../lib/db/models.js';
export function installTrackStart(bot: BotEvents): () => void {
  const listener = (snapshot: QueueSnapshot) => {
    void bot.tasks.run(() => bot.ui.announce(snapshot), 'trackStart');
  };
  bot.services.players.on('trackStart', listener);
  return () => {
    bot.services.players.off('trackStart', listener);
  };
}
