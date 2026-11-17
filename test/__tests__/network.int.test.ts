// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it, vi } from 'vitest';
import { server as mockServer } from '../msw/server';

it('database integration suites use native HTTP without MSW interception', async () => {
  const intercepted = vi.fn();
  mockServer.events.on('request:start', intercepted);
  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address() as AddressInfo;
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = http.get(`http://127.0.0.1:${port}`, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
    });
    expect(status).toBe(200);
    expect(intercepted).not.toHaveBeenCalled();
  } finally {
    mockServer.events.removeListener('request:start', intercepted);
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
});
