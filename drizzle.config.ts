import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ quiet: true });

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dbCredentials: { url: process.env.DATABASE_PATH?.trim() || './data/music.sqlite' },
  strict: true,
  verbose: false,
});
