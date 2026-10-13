import { Events } from 'discord.js';
import type { Guild, GatewayDispatchPayload } from 'discord.js';
import type { QueueSnapshot } from '../lib/db/models.js';
import { installInteractionCreate } from './interactionCreate.js';
import { installMessageCreate } from './messageCreate.js';
import { installVoiceStateUpdate, updateOccupancy } from './voiceStateUpdate.js';
import { installPlayerDisconnect } from './playerDisconnect.js';
import { installLavalinkEvents } from './lavalink.js';
import { installTrackStart } from './trackStart.js';
import { installTrackEnd } from './trackEnd.js';
import { installQueueEnd } from './queueEnd.js';
import type { BotEvents } from './types.js';

export function installEvents(bot: BotEvents): () => void {
  const detach = [
    installInteractionCreate(bot),
    installMessageCreate(bot),
    installVoiceStateUpdate(bot),
    installPlayerDisconnect(bot),
    installLavalinkEvents(bot),
    installTrackStart(bot),
    installTrackEnd(bot),
    installQueueEnd(bot),
  ];
  const raw = (packet: GatewayDispatchPayload) => {
    if (['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE', 'CHANNEL_DELETE'].includes(packet.t))
      void bot.tasks.run(
        () => bot.lavalink.sendRawData(packet as Parameters<typeof bot.lavalink.sendRawData>[0]),
        'voicePacket',
      );
  };
  const changed = (snapshot: QueueSnapshot) => {
    updateOccupancy(bot, snapshot.guildId);
    bot.ui.refresh(snapshot.guildId);
  };
  const notice = (guildId: string, message: string) => {
    void bot.tasks.run(() => bot.ui.notice(guildId, message), 'notice');
  };
  const destroyed = (guildId: string) => {
    void bot.tasks.run(() => bot.ui.end(guildId), 'playerDestroyed');
  };
  const guildDelete = (guild: Guild) => {
    if (!guild.available) return;
    void bot.tasks.run(() => bot.services.players.leave(guild.id), 'guildDelete');
  };
  bot.services.client.on(Events.Raw, raw);
  bot.services.client.on(Events.GuildDelete, guildDelete);
  bot.services.players.on('changed', changed);
  bot.services.players.on('notice', notice);
  bot.services.players.on('destroyed', destroyed);
  return () => {
    for (const remove of detach) remove();
    bot.services.client.off(Events.Raw, raw);
    bot.services.client.off(Events.GuildDelete, guildDelete);
    bot.services.players.off('changed', changed);
    bot.services.players.off('notice', notice);
    bot.services.players.off('destroyed', destroyed);
  };
}
