import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseConnection } from './client.js';

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export function findMigrationsDirectory(): string {
  const directory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(directory, 'migrations'),
    resolve(directory, '../migrations'),
    resolve(directory, '../../migrations'),
  ];
  const folder = candidates.find((candidate) =>
    existsSync(resolve(candidate, 'meta/_journal.json')),
  );
  if (!folder)
    throw new MigrationError(
      'Migration assets are missing. Run npm run build from the project root.',
    );
  return folder;
}

/** Drizzle's SQL/journal format, with an immediate SQLite lock before reading applied migrations. */
export function applyMigrations(
  connection: DatabaseConnection,
  folder = findMigrationsDirectory(),
): void {
  let migrations: MigrationMeta[];
  try {
    migrations = readMigrationFiles({ migrationsFolder: folder });
  } catch {
    throw new MigrationError(
      'Migration files or their journal cannot be read. Check the packaged migration assets.',
    );
  }
  const sqlite = connection.sqlite;
  sqlite
    .transaction(() => {
      sqlite.exec(
        'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC NOT NULL)',
      );
      const applied = sqlite
        .prepare<[], { hash: string; created_at: number }>(
          'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at',
        )
        .all();
      for (const row of applied) {
        const migration = migrations.find((item) => item.folderMillis === row.created_at);
        if (!migration || migration.hash !== row.hash) {
          throw new MigrationError(
            'Migration history differs from this build. Restore the matching migration files before starting.',
          );
        }
      }
      const appliedTimes = new Set(applied.map((row) => row.created_at));
      const insert = sqlite.prepare<[string, number]>(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      );
      for (const migration of migrations) {
        if (appliedTimes.has(migration.folderMillis)) continue;
        if (applied.some((row) => row.created_at > migration.folderMillis)) {
          throw new MigrationError('Migration history contains a gap. Repair it before starting.');
        }
        for (const statement of migration.sql) if (statement.trim()) sqlite.exec(statement);
        insert.run(migration.hash, migration.folderMillis);
      }
    })
    .immediate();
}
