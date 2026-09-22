import { McpServer } from '@modelcontextprotocol/server';
import type { OpenSolarClient } from './client/index.js';
import { SERVER_INSTRUCTIONS } from './lib/server-instructions.js';
import { registerAllToolsets, type ToolFilters } from './tools/index.js';

export interface ServerRequestContext {
  client: OpenSolarClient;
  orgId: number;
  filters: ToolFilters;
}

export function buildServer(requestContext: ServerRequestContext): McpServer {
  const server = new McpServer(
    { name: '@alignco/opensolar-mcp', version: '0.0.1' },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerAllToolsets(
    server,
    { client: requestContext.client, orgId: requestContext.orgId },
    requestContext.filters,
  );
  return server;
}
