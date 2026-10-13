import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { ConfigurationError, loadEnv } from '../src/config/env.js';

try {
  const env = loadEnv();
  for (const path of ['docker-compose.yml', 'lavalink/application.yml']) {
    const document = parseDocument(await readFile(path, 'utf8'), { uniqueKeys: true });
    if (document.errors.length > 0) {
      // Parser diagnostics can contain input, so only the filename is reported.
      throw new Error(`Invalid YAML in ${path}.`);
    }
  }
  console.info(`Configuration valid. ${env.lavalinkNodes.length} Lavalink node(s).`);
  console.info(
    `Redis ${env.REDIS_URL ? 'configured' : 'disabled'}; language ${env.DEFAULT_LANGUAGE}.`,
  );
  console.info('This validates local configuration; it does not authenticate or test playback.');
} catch (error) {
  console.error(
    error instanceof ConfigurationError
      ? error.message
      : 'Configuration file validation failed. Check that both YAML files exist and parse correctly.',
  );
  process.exitCode = 1;
}
