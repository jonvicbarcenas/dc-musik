import { config } from 'dotenv';
import { z } from 'zod';

export function loadDatabasePath(): string {
  config({ quiet: true });
  const result = z
    .string()
    .trim()
    .min(1)
    .safeParse(process.env.DATABASE_PATH?.trim() || './data/music.sqlite');
  if (!result.success) throw new Error('DATABASE_PATH must be a nonempty database filename.');
  return result.data;
}
