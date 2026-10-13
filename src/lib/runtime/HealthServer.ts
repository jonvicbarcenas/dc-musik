import { createServer } from 'node:http';
import type { Server } from 'node:http';

export interface HealthStatus {
  ready: boolean;
  bots: number;
  nodes: number;
}
/** Readiness contains aggregate counts only, never guild IDs, sources, or configuration. */
export class HealthServer {
  private server: Server | null = null;
  constructor(
    private readonly port: number,
    private readonly status: () => HealthStatus,
  ) {}
  async start(): Promise<void> {
    const server = createServer((request, response) => {
      if (request.method !== 'GET' || !['/health', '/live'].includes(request.url ?? '')) {
        response.writeHead(404).end();
        return;
      }
      const status = this.status();
      const live = request.url === '/live';
      response
        .writeHead(live || status.ready ? 200 : 503, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        .end(
          JSON.stringify({
            status: live ? 'alive' : status.ready ? 'ready' : 'starting',
            bots: status.bots,
            nodes: status.nodes,
          }),
        );
    });
    server.requestTimeout = 5000;
    server.headersTimeout = 5000;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      // Node uses a dual-stack IPv6 listener when available, including Railway's private network.
      server.listen(this.port, () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;
  }
  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
}
