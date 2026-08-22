import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIER_POLICY } from '../../src/lib/tier-policy.js';
import { createServer } from '../../src/server.js';

afterEach(async () => {
  vi.unstubAllEnvs();
});

const expectedTools = Object.keys(TIER_POLICY);

describe('tool registration', () => {
  it('registers exactly the tools listed in TIER_POLICY', async () => {
    vi.stubEnv('OPENSOLAR_API_TOKEN', 'test-token');
    vi.stubEnv('OPENSOLAR_ORG_ID', '1');

    const mcp = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'smoke', version: '0.0.0' });

    await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      expect(names).toEqual([...expectedTools].sort());
    } finally {
      await client.close();
      await mcp.close();
    }
  });
});
