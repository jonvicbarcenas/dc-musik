import type { Client } from 'discord.js';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';
import type { Repositories } from '../lib/db/contracts.js';
import type { PlayerManager } from '../lib/music/PlayerManager.js';
import type { LyricsService } from '../lib/music/LyricsService.js';
import type { Semaphore } from '../lib/utils/AsyncLock.js';
import type { CommandRegistry } from './CommandRegistry.js';
import type { CommandUI } from './CommandUI.js';
import type { VoteSkipService } from './VoteSkipService.js';

export interface CommandServices {
  client: Client<true>;
  env: Env;
  repositories: Repositories;
  players: PlayerManager;
  lyrics: LyricsService;
  registry: CommandRegistry;
  ui: CommandUI;
  votes: VoteSkipService;
  catalogWork: Semaphore;
  logger: Logger;
}
