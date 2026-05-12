import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenSolarClient } from '../client/index.js';
import { registerOrgToolset } from './org.js';
import { registerProjectsToolset } from './projects.js';

export interface ToolContext {
  client: OpenSolarClient;
  orgId: number;
}

export function registerAllToolsets(server: McpServer, ctx: ToolContext): void {
  registerProjectsToolset(server, ctx);
  registerOrgToolset(server, ctx);
}
