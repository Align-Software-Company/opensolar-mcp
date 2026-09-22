import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import type { OpenSolarClient } from '../../src/client/index.js';
import { TOOLSET_NAMES, type ToolFilters } from '../../src/tools/index.js';

export const ALL_TOOL_FILTERS: ToolFilters = {
  toolsets: [...TOOLSET_NAMES],
  readOnly: false,
  plan: undefined,
};

export function unexpectedCallClient(): OpenSolarClient {
  return {
    get: async (): Promise<unknown> => {
      throw new Error('unexpected OpenSolar call');
    },
  };
}

export async function withMcpClient<T>(
  server: McpServer,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}
