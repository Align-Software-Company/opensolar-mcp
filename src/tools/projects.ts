import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenSolarClient } from '../client/index.js';
import { curateProject, ProjectFullSchema, ProjectListSchema } from '../schemas/project.js';

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

const getProjectInputShape = {
  id: z
    .number()
    .int()
    .positive()
    .describe('The OpenSolar project ID. Use list_projects to discover IDs.'),
  verbose: z
    .boolean()
    .default(false)
    .describe(
      'When true, returns the full unfiltered project payload (~200+ KB on Raw Data tier) ' +
        'including the compressed `design` blob (base64-gzip), full contact records, system ' +
        'objects, costing, configuration, utility tariffs, and proposal content. Default ' +
        'false returns a curated subset suitable for routine LLM context, plus a ' +
        '`design_available` boolean indicating whether the design blob is reachable.',
    ),
};

const getProjectDescription =
  'Returns a single OpenSolar project by ID with metadata: title, address, lat/lon, stage, ' +
  'contacts, assigned team-member role, and a count of systems on the project. Use when the ' +
  'user references a specific project by ID and wants details beyond what list_projects ' +
  'returns. Curated by default; pass `verbose: true` for the full payload (200+ KB on Raw ' +
  'Data tier) including the compressed `design` blob and full nested objects. The curated ' +
  'response includes `design_available` (boolean) — true if the `design` field is populated, ' +
  'false if it is null or absent (the API Access tier signal). Field-name notes: assigned ' +
  'team member is exposed as `assigned_role_data` ({id, display, email}); contacts are slimmed ' +
  'from `contacts_data` to {id, display, email, phone} per contact. Tier: API Access (the ' +
  '`design` field is omitted or null on API Access; full design data requires Raw Data API ' +
  'Access).';

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

  server.registerTool(
    'get_project',
    {
      description: getProjectDescription,
      inputSchema: getProjectInputShape,
    },
    async ({ id, verbose }) => {
      const path = `orgs/${ctx.orgId}/projects/${id}/`;
      const raw = await ctx.client.get(path);
      const project = ProjectFullSchema.parse(raw);
      const payload = verbose ? project : curateProject(project);
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}
