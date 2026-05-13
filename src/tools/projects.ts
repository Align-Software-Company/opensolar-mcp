import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenSolarClient } from '../client/index.js';
import { DEFAULT_REDACTION, redactSensitive } from '../lib/redaction.js';
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
  verbose: z
    .boolean()
    .default(false)
    .describe(
      'When true, returns the full list payload with sensitive fields redacted. Credential ' +
        "containers (`integration_key_*`) preserve structure and replace values with '[REDACTED]'; " +
        'per-user integration data (`integration_json`) and simple credential strings are ' +
        'wholesale-redacted. Default false returns the standard summary list.',
    ),
};

const listProjectsDescription =
  "Lists projects in the user's OpenSolar org with pagination. Use this for discovery " +
  "questions ('what projects do I have', 'recent projects', 'projects modified this week'). " +
  'Returns an array of project summaries with id, address, stage, created_date, modified_date. ' +
  'Use `verbose: true` for the full payload with sensitive fields redacted. Credential ' +
  "containers (`integration_key_*`) preserve structure and replace values with '[REDACTED]'; " +
  'per-user integration data (`integration_json`) and simple credential strings are ' +
  'wholesale-redacted. ' +
  'Use get_project to fetch full details by ID. ' +
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
  'Data tier) including the compressed `design` blob and full nested objects, with sensitive ' +
  'fields redacted. Credential containers (`integration_key_*`) preserve structure and replace ' +
  "values with '[REDACTED]'; per-user integration data (`integration_json`) and simple " +
  'credential strings (API keys, Stripe keys, webhook secrets) are wholesale-redacted. The ' +
  'structure is otherwise identical to the API response. The curated ' +
  'response includes `design_available` (boolean) — true if the `design` field is populated, ' +
  'false if it is null or absent (the API Access tier signal). Curated mode also surfaces ' +
  '`events` — the project timeline (each event has `event_type_name` derived from ' +
  '`event_type_id`, plus title, notes, start, who, and any contact_data with PII redacted). ' +
  'Use get_event for richer per-event detail. Field-name notes: assigned ' +
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
    async ({ limit, page, verbose }) => {
      const path = `orgs/${ctx.orgId}/projects/?limit=${limit}&page=${page}`;
      const raw = await ctx.client.get(path);
      const projects = ProjectListSchema.parse(raw);
      const payload = verbose ? redactSensitive(projects, DEFAULT_REDACTION) : projects;
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
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
      const payload = verbose
        ? redactSensitive(project, DEFAULT_REDACTION)
        : curateProject(project);
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}
