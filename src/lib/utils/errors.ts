export type MusicErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'SPOTIFY_AUTH_REQUIRED'
  | 'SPOTIFY_ACCESS_DENIED'
  | 'NO_PLAYER'
  | 'QUEUE_FULL'
  | 'NOT_SEEKABLE'
  | 'UNSAFE_URL'
  | 'MEDIA_TOO_LARGE'
  | 'NODE_UNAVAILABLE'
  | 'CONFLICT';

/** Only these deliberately authored messages may be shown to Discord users. */
export class MusicError extends Error {
  constructor(
    public readonly code: MusicErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MusicError';
  }
}

export function friendlyError(error: unknown): string {
  return error instanceof MusicError
    ? error.message
    : 'Something went wrong. Please try again in a moment.';
}

export function errorCode(error: unknown): string {
  return error instanceof MusicError ? error.code : 'INTERNAL';
}
