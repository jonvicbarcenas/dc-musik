import type { z } from 'zod';
import { z as validator } from 'zod';
import type { Page, PageRequest } from './models.js';

export type RepositoryErrorCode =
  'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'LIMIT' | 'CORRUPT_DATA' | 'STALE_SNAPSHOT';
export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function validateInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new RepositoryError('INVALID_INPUT', 'Invalid database request.');
  return result.data;
}

export function validateStored<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new RepositoryError(
      'CORRUPT_DATA',
      'Stored data is invalid or uses an unsupported version.',
    );
  return result.data;
}

export function readStoredJson<T>(schema: z.ZodType<T>, text: string, maxBytes = 65_536): T {
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new RepositoryError('CORRUPT_DATA', 'Stored JSON exceeds its size limit.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new RepositoryError('CORRUPT_DATA', 'Stored JSON is invalid.');
  }
  return validateStored(schema, value);
}

/** Keeps repository APIs asynchronous and catches synchronous SQLite/validation errors. */
export function runRepository<T>(operation: () => T): Promise<T> {
  return Promise.resolve().then(operation);
}

const pageRequestSchema = validator.strictObject({
  page: validator.number().int().min(1).max(1_000_000).default(1),
  pageSize: validator.number().int().min(1).max(100).default(10),
});
export function pagination(total: number, request: PageRequest = {}) {
  const input = validateInput(pageRequestSchema, request);
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, totalPages);
  return { page, pageSize: input.pageSize, total, totalPages, offset: (page - 1) * input.pageSize };
}
export function makePage<T>(items: T[], paging: ReturnType<typeof pagination>): Page<T> {
  return {
    items,
    page: paging.page,
    pageSize: paging.pageSize,
    total: paging.total,
    totalPages: paging.totalPages,
  };
}
