import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import type { OpenSolarClient } from '../../src/client/index.js';
import { TOOLSET_NAMES, type ToolFilters } from '../../src/tools/index.js';

export const ALL_TOOL_FILTERS: ToolFilters = {
  toolsets: [...TOOLSET_NAMES],
  readOnly: false,
  plan: undefined,
};

function unexpectedWrite(): Promise<never> {
  return Promise.reject(new Error('unexpected OpenSolar write'));
}

export function testClient(get: OpenSolarClient['get']): OpenSolarClient {
  return {
    get,
    post: async () => unexpectedWrite(),
    postForm: async () => unexpectedWrite(),
    put: async () => unexpectedWrite(),
    patch: async () => unexpectedWrite(),
    delete: async () => unexpectedWrite(),
    download: async () => unexpectedWrite(),
    getFile: async () => unexpectedWrite(),
    resourceUrl(path: string) {
      return new URL(path.replace(/^\//, ''), 'https://api.opensolar.com/api/').toString();
    },
  };
}

export function unexpectedCallClient(): OpenSolarClient {
  return testClient(async () => {
    throw new Error('unexpected OpenSolar call');
  });
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

export function requireStructuredContent(result: {
  structuredContent?: unknown;
  isError?: boolean;
}): unknown {
  if (result.isError) {
    throw new Error('expected a successful tool result');
  }
  if (result.structuredContent === undefined) {
    throw new Error('expected structuredContent');
  }
  return result.structuredContent;
}
