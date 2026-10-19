import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bot: 'src/bot.ts',
    shard: 'src/shard.ts',
    'config/env': 'src/config/env.ts',
    'scripts/check-env': 'scripts/check-env.ts',
    'scripts/healthcheck': 'scripts/healthcheck.ts',
    'scripts/migrate': 'scripts/migrate.ts',
    'lib/db/index': 'src/lib/db/index.ts',
    'lib/music/index': 'src/lib/music/index.ts',
    'framework/index': 'src/framework/index.ts',
    'scripts/register-commands': 'scripts/register-commands.ts',
    'scripts/youtube-auth': 'scripts/youtube-auth.ts',
    'scripts/spotify-auth': 'scripts/spotify-auth.ts',
    'scripts/railway-env': 'scripts/railway-env.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  treeshake: true,
  external: ['better-sqlite3', 'pino-pretty'],
  noExternal: ['yaml'],
  onSuccess: () =>
    Promise.resolve().then(() => {
      cpSync('src/lib/db/migrations', 'dist/migrations', { recursive: true });
      cpSync('src/lib/web/dashboard', 'dist/dashboard', { recursive: true });
    }),
});
