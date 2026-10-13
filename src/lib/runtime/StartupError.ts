export class StartupError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'StartupError';
  }
}
/** Classify SDK failures into authored messages. Never return raw errors or their causes. */
export function discordStartupError(error: unknown, cancelled = false): StartupError {
  const code: unknown = typeof error === 'object' && error && 'code' in error ? error.code : null;
  const message = error instanceof Error ? error.message : '';
  const status: unknown =
    typeof error === 'object' && error && 'status' in error ? error.status : null;
  if (cancelled) return new StartupError('STARTUP_CANCELLED', 'Discord startup was cancelled.');
  if (code === 'DisallowedIntents' || code === 4014 || message === 'Used disallowed intents')
    return new StartupError(
      'DISCORD_INTENTS',
      'Discord rejected Message Content Intent. Open Developer Portal → your application → Bot → Privileged Gateway Intents, enable Message Content Intent, save, then restart.',
    );
  if (
    status === 401 ||
    code === 'TokenInvalid' ||
    code === 50014 ||
    code === 4004 ||
    message === 'Authentication failed'
  )
    return new StartupError(
      'DISCORD_TOKEN',
      'Discord rejected the bot token. Replace DISCORD_TOKEN with the current token from your application’s Bot page and restart.',
    );
  if (message === 'Sharding is required' || code === 4011)
    return new StartupError(
      'DISCORD_SHARDING',
      'Discord requires sharding for this application. Build the project and run npm run start:sharded.',
    );
  if (message === 'Discord readiness timed out.')
    return new StartupError(
      'DISCORD_TIMEOUT',
      'Discord login timed out. Check gateway connectivity and the application’s enabled intents, then retry.',
    );
  return new StartupError(
    'DISCORD_LOGIN',
    'Discord login failed. Check the token, gateway intents and network access.',
  );
}
export function startupDiagnostic(
  error: unknown,
  step: string,
): { step: string; code: string; message: string } {
  if (error instanceof StartupError) return { step, code: error.code, message: error.message };
  if (error instanceof Error && error.name === 'MigrationError')
    return {
      step,
      code: 'MIGRATIONS',
      message:
        'Database migrations failed. Check the packaged migration files and whether this database was created with a different build.',
    };
  const code: unknown = typeof error === 'object' && error && 'code' in error ? error.code : null;
  if (code === 'EADDRINUSE')
    return {
      step,
      code,
      message: `${step}: the configured port is already in use. Stop the other listener or change the configured port.`,
    };
  if (code === 'EACCES' || code === 'EPERM')
    return {
      step,
      code,
      message: `${step}: permission denied. Check access to the configured data/media directory or listening port.`,
    };
  if (code === 'SQLITE_CANTOPEN' || code === 'SQLITE_READONLY' || code === 'SQLITE_BUSY')
    return {
      step,
      code,
      message: `${step}: SQLite cannot open or write the configured database. Check the data directory permissions and other bot processes.`,
    };
  return {
    step,
    code: 'STARTUP_FAILED',
    message: `${step} failed. Check this step’s configuration and local services. Raw errors are withheld to protect credentials.`,
  };
}
