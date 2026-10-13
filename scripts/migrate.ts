import { loadDatabasePath } from '../src/config/database.js';
import { openDatabase } from '../src/lib/db/client.js';
import { applyMigrations, MigrationError } from '../src/lib/db/migrate.js';

try {
  const connection = openDatabase(loadDatabasePath());
  try {
    applyMigrations(connection);
    console.info('Database migrations applied successfully.');
  } finally {
    connection.close();
  }
} catch (error) {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Database migration failed. Check file permissions, DATABASE_PATH, and matching migration assets.',
  );
  process.exitCode = 1;
}
