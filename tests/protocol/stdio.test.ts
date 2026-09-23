import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

async function listenMockOpenSolar(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const payload = JSON.stringify(loadOpenSolarFixture('org', 'summary'));
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/orgs/1/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(payload);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('mock OpenSolar server did not bind a port');
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api/`,
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

describe('stdio protocol', () => {
  it('lists tools and calls get_org over a spawned stdio process', async () => {
    const mock = await listenMockOpenSolar();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxCli, 'src/index.ts'],
      cwd: repoRoot,
      env: {
        ...getDefaultEnvironment(),
        OPENSOLAR_API_TOKEN: 'test-token',
        OPENSOLAR_ORG_ID: '1',
        OPENSOLAR_BASE_URL: mock.baseUrl,
      },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'stdio-test', version: '0.0.0' });

    try {
      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toContain('get_org');

      const result = await client.callTool({ name: 'get_org', arguments: {} });
      expect(result.structuredContent).toEqual(
        expect.objectContaining({ id: 1, name: 'Example Solar Co' }),
      );
      const text = result.content[0];
      if (text?.type !== 'text') {
        throw new Error('expected text content');
      }
      expect(text.text).toBe('Org 1: Example Solar Co.');
    } finally {
      await client.close();
      await mock.close();
    }
  });
});
