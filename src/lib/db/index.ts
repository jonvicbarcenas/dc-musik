import type { DatabaseConnection } from './client.js';
import type { Repositories } from './contracts.js';
import type { GuildSettingsPatch, RepositoryLimits } from './models.js';
import { repositoryLimitsSchema } from './models.js';
import { validateInput } from './validation.js';
import { SqliteBlacklistRepository } from './repositories/blacklist.js';
import { SqliteGuildSettingsRepository } from './repositories/guildSettings.js';
import { SqliteHistoryRepository } from './repositories/history.js';
import { SqlitePlaylistsRepository } from './repositories/playlists.js';
import { SqliteQueueSnapshotsRepository } from './repositories/queueSnapshots.js';
import { SqliteUserFavoritesRepository } from './repositories/userFavorites.js';

export interface RepositoryOptions {
  guildDefaults?: GuildSettingsPatch;
  limits?: Partial<RepositoryLimits>;
}
export function createRepositories(
  connection: DatabaseConnection,
  options: RepositoryOptions = {},
): Repositories {
  const limits = validateInput(repositoryLimitsSchema, options.limits ?? {});
  const db = connection.db;
  return {
    guildSettings: new SqliteGuildSettingsRepository(db, options.guildDefaults),
    userFavorites: new SqliteUserFavoritesRepository(db, limits.favoritesPerUser),
    playlists: new SqlitePlaylistsRepository(db, limits),
    history: new SqliteHistoryRepository(db, limits.historyPerUser),
    queueSnapshots: new SqliteQueueSnapshotsRepository(db),
    blacklist: new SqliteBlacklistRepository(db),
  };
}

export { openDatabase } from './client.js';
export { applyMigrations, findMigrationsDirectory, MigrationError } from './migrate.js';
export { RepositoryError } from './validation.js';
export type { DatabaseConnection } from './client.js';
export type { Repositories } from './contracts.js';
