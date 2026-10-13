import type { BotEvents } from './types.js';
import type { QueueSnapshot } from '../lib/db/models.js';
export function installQueueEnd(bot: BotEvents): () => void {
  const listener = (snapshot: QueueSnapshot) => {
    void bot.tasks.run(() => bot.ui.end(snapshot.guildId), 'queueEnd');
  };
  bot.services.players.on('queueEnd', listener);
  return () => {
    bot.services.players.off('queueEnd', listener);
  };
}
