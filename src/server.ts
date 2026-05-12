import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from './client/index.js';
import { loadConfig } from './lib/config.js';
import { registerAllToolsets } from './tools/index.js';

export function createServer(): McpServer {
  const config = loadConfig();
  const client = createClient(config);

  const server = new McpServer(
    { name: '@alignco/opensolar-mcp', version: '0.0.1' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  registerAllToolsets(server, { client, orgId: config.OPENSOLAR_ORG_ID });

  server.server.setRequestHandler(ListResourcesRequestSchema, () =>
    Promise.resolve({ resources: [] }),
  );
  server.server.setRequestHandler(ListPromptsRequestSchema, () => Promise.resolve({ prompts: [] }));

  return server;
}
