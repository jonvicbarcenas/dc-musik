import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;
export type DatabaseExecutor = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete'>;
export interface DatabaseConnection {
  db: AppDatabase;
  sqlite: Database.Database;
  close(): void;
}

export function openDatabase(path = './data/music.sqlite'): DatabaseConnection {
  const filename = path === ':memory:' ? path : resolve(path);
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new Database(filename, { timeout: 5000 });
  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = FULL');
    const db = drizzle(sqlite, { schema, logger: false });
    return {
      db,
      sqlite,
      close: () => {
        if (sqlite.open) sqlite.close();
      },
    };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}
