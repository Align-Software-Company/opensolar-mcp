import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIST_CACHE_TTL_MS, SERVER_TITLE } from '../../src/server.js';
import { createHttpApp } from '../../src/transports/http.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';

async function listenApp(
  app: ReturnType<typeof createHttpApp>,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: ServerType = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('HTTP test server did not bind a port');
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('stateless HTTP transport', () => {
  it('serves health outside the MCP path', async () => {
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    const app = createHttpApp({
      host: '127.0.0.1',
      port: 3000,
      path: '/mcp',
      allowedHosts: undefined,
    });
    const listening = await listenApp(app);
    try {
      const health = await fetch(`${listening.origin}/health`);
      const ready = await fetch(`${listening.origin}/ready`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: 'ok' });
      expect(ready.status).toBe(200);
      expect(await ready.json()).toEqual({ status: 'ready' });
    } finally {
      await listening.close();
    }
  });

  it('uses a fresh server instance and per-request token on independent calls', async () => {
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.opensolar.com/api/');

    const seenTokens: string[] = [];
    const payload = loadOpenSolarFixture('org', 'summary');
    const originalFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | Request | string, init?: RequestInit) => {
        const url = new URL(String(input instanceof Request ? input.url : input));
        if (url.hostname === 'api.opensolar.com') {
          const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
          seenTokens.push(headers.get('authorization') ?? '');
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      }),
    );

    const app = createHttpApp({
      host: '127.0.0.1',
      port: 3000,
      path: '/mcp',
      allowedHosts: undefined,
    });
    const listening = await listenApp(app);

    const callGetOrg = async (token: string): Promise<string> => {
      const transport = new StreamableHTTPClientTransport(new URL(`${listening.origin}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      });
      const client = new Client({ name: 'http-test', version: '0.0.0' });
      await client.connect(transport);
      try {
        const result = await client.callTool({ name: 'get_org', arguments: {} });
        if (result.structuredContent === undefined) {
          throw new Error('expected structuredContent');
        }
        return JSON.stringify(result.structuredContent);
      } finally {
        await client.close();
      }
    };

    try {
      const first = await callGetOrg('token-a');
      const second = await callGetOrg('token-b');

      expect(JSON.parse(first)).toEqual(
        expect.objectContaining({ id: 1, name: 'Example Solar Co' }),
      );
      expect(JSON.parse(second)).toEqual(expect.objectContaining({ id: 1 }));
      expect(seenTokens).toEqual(['Bearer token-a', 'Bearer token-b']);
    } finally {
      await listening.close();
    }
  });

  it('serves 2026-07-28 clients with server identity and tools/list cache hints', async () => {
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'loopback-token');
    const app = createHttpApp({
      host: '127.0.0.1',
      port: 3000,
      path: '/mcp',
      allowedHosts: undefined,
    });
    const listening = await listenApp(app);
    const client = new Client(
      { name: 'http-modern-test', version: '0.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`${listening.origin}/mcp`)));
      expect(client.getProtocolEra()).toBe('modern');
      expect(client.getServerVersion()).toEqual(
        expect.objectContaining({ name: '@alignco/opensolar-mcp', title: SERVER_TITLE }),
      );
      const listed = await client.listTools();
      expect(listed).toEqual(
        expect.objectContaining({ ttlMs: LIST_CACHE_TTL_MS, cacheScope: 'private' }),
      );
      expect(listed.tools.length).toBeGreaterThan(0);
    } finally {
      await client.close();
      await listening.close();
    }
  });

  it('allows loopback HTTP to use the environment token when no header is supplied', async () => {
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'loopback-token');
    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.opensolar.com/api/');

    const seenTokens: string[] = [];
    const payload = loadOpenSolarFixture('org', 'summary');
    const originalFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | Request | string, init?: RequestInit) => {
        const url = new URL(String(input instanceof Request ? input.url : input));
        if (url.hostname === 'api.opensolar.com') {
          const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
          seenTokens.push(headers.get('authorization') ?? '');
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      }),
    );

    const app = createHttpApp({
      host: '127.0.0.1',
      port: 3000,
      path: '/mcp',
      allowedHosts: undefined,
    });
    const listening = await listenApp(app);
    const transport = new StreamableHTTPClientTransport(new URL(`${listening.origin}/mcp`));
    const client = new Client({ name: 'http-loopback-test', version: '0.0.0' });
    try {
      await client.connect(transport);
      await client.callTool({ name: 'get_org', arguments: {} });
      expect(seenTokens).toEqual(['Bearer loopback-token']);
    } finally {
      await client.close();
      await listening.close();
    }
  });

  it('rejects an untrusted browser Origin on non-loopback HTTP', async () => {
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    const app = createHttpApp({
      host: '0.0.0.0',
      port: 3000,
      path: '/mcp',
      allowedHosts: ['127.0.0.1'],
      allowedOrigins: ['trusted.example'],
    });
    const listening = await listenApp(app);
    try {
      const blocked = await fetch(`${listening.origin}/health`, {
        headers: { Origin: 'https://evil.example' },
      });
      expect(blocked.status).toBe(403);

      const allowed = await fetch(`${listening.origin}/health`, {
        headers: { Origin: 'https://trusted.example' },
      });
      expect(allowed.status).toBe(200);
    } finally {
      await listening.close();
    }
  });

  it('requires a per-request bearer token on non-loopback HTTP and ignores the env token', async () => {
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'server-env-token');
    vi.stubEnv('OPENSOLAR_BASE_URL', 'https://api.opensolar.com/api/');

    const seenTokens: string[] = [];
    const payload = loadOpenSolarFixture('org', 'summary');
    const originalFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | Request | string, init?: RequestInit) => {
        const url = new URL(String(input instanceof Request ? input.url : input));
        if (url.hostname === 'api.opensolar.com') {
          const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
          seenTokens.push(headers.get('authorization') ?? '');
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      }),
    );

    const app = createHttpApp({
      host: '0.0.0.0',
      port: 3000,
      path: '/mcp',
      allowedHosts: ['127.0.0.1'],
    });
    const listening = await listenApp(app);
    try {
      const anonymousResponse = await fetch(`${listening.origin}/mcp`);
      expect(anonymousResponse.status).toBe(401);
      expect(anonymousResponse.headers.get('www-authenticate')).toBe('Bearer');

      const malformedResponse = await fetch(`${listening.origin}/mcp`, {
        headers: { Authorization: 'Bearer request-token extra' },
      });
      expect(malformedResponse.status).toBe(401);

      const anonymousTransport = new StreamableHTTPClientTransport(
        new URL(`${listening.origin}/mcp`),
      );
      const anonymousClient = new Client({ name: 'http-anonymous-test', version: '0.0.0' });
      await expect(anonymousClient.connect(anonymousTransport)).rejects.toThrow();
      await anonymousClient.close().catch(() => undefined);
      expect(seenTokens).toEqual([]);

      const transport = new StreamableHTTPClientTransport(new URL(`${listening.origin}/mcp`), {
        requestInit: { headers: { Authorization: 'Bearer request-token' } },
      });
      const client = new Client({ name: 'http-public-test', version: '0.0.0' });
      await client.connect(transport);
      try {
        await client.callTool({ name: 'get_org', arguments: {} });
        expect(seenTokens).toEqual(['Bearer request-token']);
      } finally {
        await client.close();
      }
    } finally {
      await listening.close();
    }
  });
});
