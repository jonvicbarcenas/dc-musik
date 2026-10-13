import { pino } from 'pino';
import type { Env } from '../../config/env.js';

/** Do not log raw provider errors, queries, track encodings, voice packets, or SDK payloads. */
export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'LOG_PRETTY'>) {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'token',
        'password',
        'authorization',
        'secret',
        'cookie',
        'headers',
        'env',
        'encoded',
        '*.token',
        '*.password',
        '*.authorization',
        '*.secret',
        '*.cookie',
        '*.headers',
        '*.encoded',
      ],
      censor: '[REDACTED]',
    },
    ...(env.LOG_PRETTY
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
