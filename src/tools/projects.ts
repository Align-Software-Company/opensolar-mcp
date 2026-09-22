import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { DEFAULT_REDACTION, redactSensitive } from '../lib/redaction.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  curateProject,
  curateProjectListRow,
  ProjectFullSchema,
  ProjectListSchema,
} from '../schemas/project.js';

export interface ProjectsContext {
  client: OpenSolarClient;
  orgId: number;
}

const listProjectsInputSchema = z.object({
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
});

const listProjectsDescription =
  "Lists projects in the user's OpenSolar org, one page at a time. Default returns `{ projects, page, limit }`. " +
  'Each project has id, title, address, dates, stage, stage_milestone, and workflow ids when OpenSolar sent them. ' +
  'Use `verbose: true` for the redacted full list objects. Sensitive fields are stripped on both paths. ' +
  'Use get_project for one project. API Access.';

const getProjectInputSchema = z.object({
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
});

const getProjectDescription =
  'Returns a single OpenSolar project by ID: title, address, lat/lon, stage, stage_milestone, ' +
  'workflow ids, contacts, assigned role, system_count, design_available, and events. Use when ' +
  'the user names a project id from list_projects. Curated by default. `verbose: true` returns ' +
  'the redacted full object; `design` is replaced with `[REDACTED]`. API Access omits or nulls `design`.';

export function registerProjectsToolset(
  server: McpServer,
  ctx: ProjectsContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_projects')) {
    server.registerTool(
      'list_projects',
      {
        description: listProjectsDescription,
        inputSchema: listProjectsInputSchema,
      },
      async ({ limit, page, verbose }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/projects/?limit=${limit}&page=${page}`;
          const raw = await ctx.client.get(path);
          const projects = ProjectListSchema.parse(raw);
          const payload = verbose
            ? redactSensitive(projects, DEFAULT_REDACTION)
            : redactSensitive(
                {
                  projects: projects.map(curateProjectListRow),
                  page,
                  limit,
                },
                DEFAULT_REDACTION,
              );
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          };
        }),
    );
  }

  if (enabled.has('get_project')) {
    server.registerTool(
      'get_project',
      {
        description: getProjectDescription,
        inputSchema: getProjectInputSchema,
      },
      async ({ id, verbose }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/projects/${id}/`;
          const raw = await ctx.client.get(path);
          const project = ProjectFullSchema.parse(raw);
          const payload = verbose
            ? redactSensitive(project, DEFAULT_REDACTION)
            : redactSensitive(curateProject(project), DEFAULT_REDACTION);
          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          };
        }),
    );
  }
}
