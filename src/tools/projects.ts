import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenSolarClient } from '../client/index.js';
import { ProjectListSchema } from '../schemas/project.js';

export interface ProjectsContext {
  client: OpenSolarClient;
  orgId: number;
}

const listProjectsInputShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum projects per page. Defaults to 20, capped at 100.'),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('1-indexed page number. Use page=2 to fetch the next batch of results.'),
};

const listProjectsDescription =
  "Lists projects in the user's OpenSolar org with pagination. Use this for discovery " +
  "questions ('what projects do I have', 'recent projects', 'projects modified this week'). " +
  'Returns an array of project summaries with id, address, stage, created_date, modified_date. ' +
  'Use get_project (not yet implemented) to fetch full details by ID. ' +
  'Tier: API Access (no degradation in v1 list response).';

export function registerProjectsToolset(server: McpServer, ctx: ProjectsContext): void {
  server.registerTool(
    'list_projects',
    {
      description: listProjectsDescription,
      inputSchema: listProjectsInputShape,
    },
    async ({ limit, page }) => {
      const path = `orgs/${ctx.orgId}/projects/?limit=${limit}&page=${page}`;
      const raw = await ctx.client.get(path);
      const projects = ProjectListSchema.parse(raw);
      return {
        content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      };
    },
  );
}
