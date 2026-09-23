import { McpServer } from '@modelcontextprotocol/server';
import type { OpenSolarClient } from './client/index.js';
import { readPackageVersion } from './lib/package-version.js';
import { SERVER_INSTRUCTIONS } from './lib/server-instructions.js';
import { registerAllToolsets, type ToolFilters } from './tools/index.js';

export interface ServerRequestContext {
  client: OpenSolarClient;
  orgId: number;
  filters: ToolFilters;
  uploadRoot?: string;
}

export function buildServer(requestContext: ServerRequestContext): McpServer {
  const server = new McpServer(
    { name: '@alignco/opensolar-mcp', version: readPackageVersion() },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerAllToolsets(
    server,
    { client: requestContext.client, orgId: requestContext.orgId, uploadRoot: requestContext.uploadRoot },
    requestContext.filters,
  );
  return server;
}
