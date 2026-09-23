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

export const SERVER_NAME = '@alignco/opensolar-mcp';
export const SERVER_TITLE = 'OpenSolar MCP';
export const SERVER_DESCRIPTION =
  'Unofficial, self-hosted MCP server for the documented OpenSolar API.';
export const SERVER_WEBSITE_URL = 'https://github.com/Align-Software-Company/opensolar-mcp';

// The tool surface is fixed for the life of the process, so 2026-era clients
// may reuse tools/list and server/discover briefly. Results stay private
// because the list depends on the operator's profile and filter settings.
export const LIST_CACHE_TTL_MS = 300_000;

export function buildServer(requestContext: ServerRequestContext): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      title: SERVER_TITLE,
      description: SERVER_DESCRIPTION,
      version: readPackageVersion(),
      websiteUrl: SERVER_WEBSITE_URL,
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      cacheHints: {
        'tools/list': { ttlMs: LIST_CACHE_TTL_MS, cacheScope: 'private' },
        'server/discover': { ttlMs: LIST_CACHE_TTL_MS, cacheScope: 'private' },
      },
    },
  );
  registerAllToolsets(
    server,
    {
      client: requestContext.client,
      orgId: requestContext.orgId,
      uploadRoot: requestContext.uploadRoot,
    },
    requestContext.filters,
  );
  return server;
}
