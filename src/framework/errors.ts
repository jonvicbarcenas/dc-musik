import { MusicError } from '../lib/utils/errors.js';
import { RepositoryError } from '../lib/db/validation.js';

export class CommandError extends Error {
  constructor(
    public readonly code:
      'ARGUMENT' | 'PERMISSION' | 'VOICE' | 'COOLDOWN' | 'BLACKLIST' | 'GUILD_ONLY',
    message: string,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}
export function commandErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'The bot is restarting. This request was cancelled.';
  if (error instanceof CommandError || error instanceof MusicError) return error.message;
  if (error instanceof RepositoryError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'That saved item was not found or does not belong to you.';
      case 'CONFLICT':
        return 'That name or item already exists. Choose another name.';
      case 'LIMIT':
        return 'Your saved-item limit has been reached. Remove an item first.';
      case 'INVALID_INPUT':
        return 'Check the name, positions, and setting values, then try again.';
      case 'STALE_SNAPSHOT':
        return 'The player changed while this command was running. Try again.';
      case 'CORRUPT_DATA':
        return 'This saved item could not be read. Ask the bot owner to check the database.';
    }
  }
  return 'Something went wrong. Please try again in a moment.';
}
export function commandErrorCode(error: unknown): string {
  return error instanceof CommandError ||
    error instanceof MusicError ||
    error instanceof RepositoryError
    ? error.code
    : 'INTERNAL';
}
