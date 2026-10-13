import { z } from 'zod';

try {
  const port = z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .parse(process.env.HEALTH_PORT || 3000);
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(4000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Not ready.');
  const body: unknown = await response.json();
  z.object({ status: z.literal('ready') }).parse(body);
} catch {
  console.error('Bot health check failed: the process is not ready.');
  process.exitCode = 1;
}
