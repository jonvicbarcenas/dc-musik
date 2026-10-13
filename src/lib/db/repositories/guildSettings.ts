import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../client.js';
import type { GuildSettingsRepository } from '../contracts.js';
import {
  guildSettingsSchema,
  settingsDefaultsSchema,
  settingsPatchSchema,
  snowflakeSchema,
} from '../models.js';
import type { GuildSettingsPatch } from '../models.js';
import { guildSettings } from '../schema.js';
import { RepositoryError, runRepository, validateInput, validateStored } from '../validation.js';

export class SqliteGuildSettingsRepository implements GuildSettingsRepository {
  private readonly defaults: GuildSettingsPatch;
  constructor(
    private readonly db: AppDatabase,
    defaults: GuildSettingsPatch = {},
  ) {
    this.defaults = validateInput(settingsDefaultsSchema, defaults);
  }

  get(guildId: string) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, guildId);
      const now = Date.now();
      this.db
        .insert(guildSettings)
        .values({ ...this.defaults, guildId: id, createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .run();
      const row = this.db.select().from(guildSettings).where(eq(guildSettings.guildId, id)).get();
      if (!row) throw new RepositoryError('NOT_FOUND', 'Guild settings were not found.');
      return validateStored(guildSettingsSchema, row);
    });
  }

  update(guildId: string, patch: GuildSettingsPatch) {
    return runRepository(() => {
      const id = validateInput(snowflakeSchema, guildId);
      const values = validateInput(settingsPatchSchema, patch);
      return this.db.transaction(
        (tx) => {
          const now = Date.now();
          tx.insert(guildSettings)
            .values({ ...this.defaults, guildId: id, createdAt: now, updatedAt: now })
            .onConflictDoNothing()
            .run();
          const row = tx
            .update(guildSettings)
            .set({ ...values, updatedAt: now })
            .where(eq(guildSettings.guildId, id))
            .returning()
            .get();
          if (!row) throw new RepositoryError('NOT_FOUND', 'Guild settings were not found.');
          return validateStored(guildSettingsSchema, row);
        },
        { behavior: 'immediate' },
      );
    });
  }
}
