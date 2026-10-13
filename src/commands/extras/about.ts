import { defineCommand } from '../../framework/Command.js';
export const sourceCredits =
  'Powered by discord.js, Lavalink, lavalink-client, LavaSrc, youtube-source, LavaLyrics, optional SponsorBlock, LRCLIB, and lyrics.ovh.';
const command = defineCommand({
  name: 'about',
  description: 'Show source credits and how full-song mirroring works',
  category: 'extras',
  execute: async (context) => {
    await context.notice(
      'Discord Music Stream plays full tracks through Lavalink. Spotify, Apple Music, Deezer, and Yandex links provide metadata for validated YouTube/YouTube Music/SoundCloud mirrors. No matching full track means unavailable; previews are never a fallback.\n\n' +
        sourceCredits,
      'About',
      'info',
    );
  },
});
export const { slash, aliases, execute } = command;
export default command;
