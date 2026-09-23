import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import {
  type ProjectMatch,
  type ProjectMatchSource,
  projectMatchStrength,
  rankProject,
} from '../lib/entity-match.js';
import { loadProjectSnapshot } from '../lib/project-snapshot.js';
import { DEFAULT_REDACTION, redactSensitive } from '../lib/redaction.js';
import { resolveWorkflowStage } from '../lib/resolve-workflow-stage.js';
import {
  BareListPageError,
  scanPaginatedCollection,
  searchResolution,
} from '../lib/scan-pages.js';
import type { ToolName } from '../lib/tier-policy.js';
import { ContactWriteSchema } from '../schemas/contact.js';
import {
  curateProject,
  curateProjectListRow,
  DeletedRecordSchema,
  GetProjectCuratedSchema,
  GetProjectOutputSchema,
  ListProjectsOutputSchema,
  ProjectFullSchema,
  ProjectListSchema,
  ProjectStageResultSchema,
  ProjectSummarySchema,
  ProjectUsageResultSchema,
  ProjectWriteResultSchema,
} from '../schemas/project.js';
import { ProjectSnapshotSchema } from '../schemas/project-snapshot.js';
import {
  SEARCH_PAGE_SIZE,
  SearchInputSchema,
  SearchProjectsOutputSchema,
} from '../schemas/search.js';
import { WorkflowSchema } from '../schemas/workflow.js';

export interface ProjectsContext {
  client: OpenSolarClient;
  orgId: number;
}

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;
const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;
const updateAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const usageSources = [
  'kwh_annual',
  'bill_annual',
  'kwh_monthly',
  'bill_monthly',
  'kwh_daily_per_month',
  'kwh_every_second_month',
  'bill_every_second_month',
  'kwh_quarterly',
  'bill_quarterly',
  'estimate',
] as const;

const annualUsageSources = new Set<string>(['kwh_annual', 'bill_annual']);
const twelveValueSources = new Set<string>(['kwh_monthly', 'bill_monthly', 'kwh_daily_per_month']);
const sixValueSources = new Set<string>(['kwh_every_second_month', 'bill_every_second_month']);
const fourValueSources = new Set<string>(['kwh_quarterly', 'bill_quarterly']);

const updateProjectUsageInputSchema = z
  .object({
    project_id: z.number().int().positive().describe('Project id from list_projects.'),
    usage_data_source: z.enum(usageSources).describe('Documented energy-consumption source.'),
    values: z
      .union([z.number().int(), z.array(z.number().int()), z.enum(['Low', 'Medium', 'High'])])
      .describe('Integers, or Low, Medium, or High. The shape must match the source.'),
  })
  .strict()
  .superRefine((value, ctx) => {
    const { usage_data_source: source, values } = value;
    if (source === 'estimate') {
      if (values !== 'Low' && values !== 'Medium' && values !== 'High') {
        ctx.addIssue({
          code: 'custom',
          message: 'estimate values must be Low, Medium, or High',
          path: ['values'],
        });
      }
      return;
    }
    if (annualUsageSources.has(source)) {
      if (typeof values !== 'number') {
        ctx.addIssue({
          code: 'custom',
          message: 'annual values must be one integer',
          path: ['values'],
        });
      }
      return;
    }
    const expectedLength = twelveValueSources.has(source)
      ? 12
      : sixValueSources.has(source)
        ? 6
        : fourValueSources.has(source)
          ? 4
          : undefined;
    if (!Array.isArray(values) || values.length !== expectedLength) {
      ctx.addIssue({
        code: 'custom',
        message: `values must contain ${expectedLength} integers`,
        path: ['values'],
      });
    }
  });

const projectScalarFields = {
  address: z.string().optional().describe('Street address.'),
  locality: z.string().optional().describe('City or locality.'),
  state: z.string().optional().describe('State or region.'),
  zip: z.string().optional().describe('Postal code.'),
  country_iso2: z.string().optional().describe('ISO 3166-1 alpha-2 country code.'),
  lat: z.number().optional().describe('Latitude.'),
  lon: z.number().optional().describe('Longitude.'),
  is_residential: z.boolean().optional().describe('True when the project is residential.'),
  lead_source: z.string().optional().describe('Lead source label.'),
  notes: z.string().optional().describe('Project notes.'),
  identifier: z.string().optional().describe('External identifier.'),
  number_of_phases: z.number().int().optional().describe('Electrical phase count.'),
  roof_type: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Roof type id from list_roof_types. Sent as the roof type URL.'),
  assigned_role: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Role id from list_roles. Sent as the role URL.'),
};

const createProjectInputSchema = z
  .object({
    ...projectScalarFields,
    contacts_new: z
      .array(ContactWriteSchema)
      .optional()
      .describe('People to create with the project. Each person uses the create_contact fields.'),
  })
  .strict();

const updateProjectInputSchema = z
  .object({
    id: z.number().int().positive().describe('Project id from list_projects.'),
    ...projectScalarFields,
  })
  .strict()
  .refine(
    (value) => Object.entries(value).some(([key, field]) => key !== 'id' && field !== undefined),
    {
      message: 'At least one field besides id is required',
    },
  );

const updateProjectStageInputSchema = z
  .object({
    project_id: z.number().int().positive().describe('Project id from list_projects.'),
    active_stage_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Stage id from the workflow. Do not send this together with stage_name.'),
    stage_name: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Stage title on the workflow. Resolved locally. Do not send this together with active_stage_id.',
      ),
    workflow_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Workflow id. Required with active_stage_id. With stage_name, the project workflow is used when this is omitted.',
      ),
  })
  .strict()
  .refine((value) => (value.active_stage_id !== undefined) !== (value.stage_name !== undefined), {
    message: 'Send exactly one of active_stage_id or stage_name',
  })
  .refine((value) => value.active_stage_id === undefined || value.workflow_id !== undefined, {
    message: 'workflow_id is required with active_stage_id',
  });

const projectScalarKeys = [
  'address',
  'locality',
  'state',
  'zip',
  'country_iso2',
  'lat',
  'lon',
  'is_residential',
  'lead_source',
  'notes',
  'identifier',
  'number_of_phases',
] as const;

type ProjectWriteInput = {
  address?: string;
  locality?: string;
  state?: string;
  zip?: string;
  country_iso2?: string;
  lat?: number;
  lon?: number;
  is_residential?: boolean;
  lead_source?: string;
  notes?: string;
  identifier?: string;
  number_of_phases?: number;
  roof_type?: number;
  assigned_role?: number;
  contacts_new?: Array<{
    first_name?: string;
    family_name?: string;
    email?: string;
    phone?: string;
  }>;
};

function projectWriteBody(
  ctx: ProjectsContext,
  input: ProjectWriteInput,
  includeContacts: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of projectScalarKeys) {
    const value = input[key];
    if (value !== undefined) {
      body[key] = value;
    }
  }
  if (input.roof_type !== undefined) {
    body.roof_type = ctx.client.resourceUrl(`roof_types/${input.roof_type}/`);
  }
  if (input.assigned_role !== undefined) {
    body.assigned_role = ctx.client.resourceUrl(`orgs/${ctx.orgId}/roles/${input.assigned_role}/`);
  }
  if (includeContacts && input.contacts_new !== undefined) {
    body.contacts_new = input.contacts_new.map((contact) => {
      const person: Record<string, string> = {};
      if (contact.first_name !== undefined) {
        person.first_name = contact.first_name;
      }
      if (contact.family_name !== undefined) {
        person.family_name = contact.family_name;
      }
      if (contact.email !== undefined) {
        person.email = contact.email;
      }
      if (contact.phone !== undefined) {
        person.phone = contact.phone;
      }
      return person;
    });
  }
  return body;
}

function projectStageBody(workflowId: number, activeStageId: number): Record<string, unknown> {
  return {
    workflow: { active_stage_id: activeStageId, workflow_id: workflowId },
    active_stage_id: activeStageId,
  };
}

function projectUsageBody(input: {
  usage_data_source: string;
  values: number | number[] | 'Low' | 'Medium' | 'High';
}): Record<string, unknown> {
  return {
    usage: {
      usage_data_source: input.usage_data_source,
      values: input.values,
    },
  };
}

function projectUsageResult(raw: unknown, source: string) {
  const parsed = z.object({ id: z.number() }).passthrough().parse(raw);
  const payload = ProjectUsageResultSchema.parse({
    project_id: parsed.id,
    usage_data_source: source,
  });
  return openSolarSuccess(
    payload,
    `Project ${payload.project_id} usage is ${payload.usage_data_source}.`,
  );
}

function projectStageResult(raw: unknown, workflowId: number, activeStageId: number) {
  const parsed = z.object({ id: z.number() }).passthrough().parse(raw);
  const payload = ProjectStageResultSchema.parse({
    project_id: parsed.id,
    workflow_id: workflowId,
    active_stage_id: activeStageId,
  });
  return openSolarSuccess(
    payload,
    `Project ${payload.project_id} is on stage ${payload.active_stage_id}.`,
  );
}

function projectWriteResult(raw: unknown) {
  const parsed = z
    .object({
      id: z.number(),
      address: z.string().nullish(),
    })
    .passthrough()
    .parse(raw);
  const payload = ProjectWriteResultSchema.parse({ id: parsed.id, address: parsed.address });
  const summary =
    typeof payload.address === 'string' && payload.address !== ''
      ? `Project ${payload.id}: ${payload.address}.`
      : `Project ${payload.id}.`;
  return openSolarSuccess(payload, summary);
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
      'When true, `projects` is the full redacted list objects. ' +
        'Default false returns curated rows. Both paths use `{ projects, page, limit }`.',
    ),
});

const getProjectInputSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe(
      'The OpenSolar project ID. Use search_projects for a named/address lookup or list_projects for browsing.',
    ),
  verbose: z
    .boolean()
    .default(false)
    .describe(
      'When true, returns the full redacted project object. The compressed `design` field ' +
        'is replaced with `[REDACTED]`. Default false returns the curated subset plus ' +
        '`design_available`.',
    ),
});

export function registerProjectsToolset(
  server: McpServer,
  ctx: ProjectsContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_projects')) {
    server.registerTool(
      'list_projects',
      {
        title: 'List projects',
        description:
          'Lists one page of projects in the connected org. Default result is `{ projects, page, limit }` ' +
          'with id, title, address, dates, stage, stage_milestone, and workflow ids when OpenSolar sent them. ' +
          '`verbose: true` returns `{ projects, page, limit }` with the full redacted list objects. ' +
          'Use search_projects when you know a name, address, email, or phone. Use get_project only when you need detail beyond a list or search row.',
        inputSchema: listProjectsInputSchema,
        outputSchema: ListProjectsOutputSchema,
        annotations: readAnnotations,
      },
      async ({ limit, page, verbose }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/projects/?limit=${limit}&page=${page}`;
          const raw = await ctx.client.get(path);
          const projects = ProjectListSchema.parse(raw);
          const payload = ListProjectsOutputSchema.parse(
            redactSensitive(
              {
                projects: verbose ? projects : projects.map(curateProjectListRow),
                page,
                limit,
              },
              DEFAULT_REDACTION,
            ),
          );
          const summary = verbose
            ? `Full redacted project list, ${payload.projects.length} items.`
            : `${payload.projects.length} projects on page ${payload.page} (limit ${payload.limit}).`;
          return openSolarSuccess(payload, summary);
        }),
    );
  }

  if (enabled.has('search_projects')) {
    server.registerTool(
      'search_projects',
      {
        title: 'Search projects',
        description:
          'Finds projects by paging the documented project list and matching locally. It does not call get_project and it does not send a search query. ' +
          'The documented list includes title, address, business_name, and embedded contact name, email, and phone. ' +
          'identifier, locality, state, and zip match only when that list row carries them. ' +
          'The scan reads until the list ends or max_pages is reached. Returned rows are the strongest matches. Equal strength keeps list order. ' +
          '`resolution` is `none`, `unique`, `ambiguous`, or `incomplete`. Only `unique` proves exactly one match after exhausting the scan. ' +
          '`complete` is false when further pages were not read. `results_truncated` is true when some matches on the scanned pages were not returned. `stopped_by` is `end` or `max_pages`. ' +
          'The 20-page cap is an MCP work bound, not an OpenSolar quota. This server does not count that quota.',
        inputSchema: SearchInputSchema,
        outputSchema: SearchProjectsOutputSchema,
        annotations: readAnnotations,
      },
      async ({ query, max_pages, max_results }) =>
        runOpenSolarTool(async () => {
          try {
            const scan = await scanPaginatedCollection({
              pageSize: SEARCH_PAGE_SIZE,
              maxPages: max_pages,
              maxResults: max_results,
              match: (item: unknown) => matchProject(query, item),
              strength: (row) => projectMatchStrength(row.match),
              fetchPage: async (page) => {
                const params = new URLSearchParams({
                  page: String(page),
                  limit: String(SEARCH_PAGE_SIZE),
                });
                const raw = await ctx.client.get(
                  `orgs/${ctx.orgId}/projects/?${params.toString()}`,
                );
                if (!Array.isArray(raw)) {
                  throw new BareListPageError('Project list was not an array.');
                }
                return raw;
              },
            });
            const payload = SearchProjectsOutputSchema.parse({
              matches: scan.matches,
              search: {
                query,
                records_scanned: scan.records_scanned,
                pages_scanned: scan.pages_scanned,
                complete: scan.complete,
                results_truncated: scan.results_truncated,
                resolution: searchResolution({
                  matchCount: scan.matches.length,
                  complete: scan.complete,
                  resultsTruncated: scan.results_truncated,
                }),
                stopped_by: scan.stopped_by,
              },
            });
            const finished = payload.search.complete
              ? 'The list was exhausted.'
              : 'Further pages were not read.';
            const dropped = payload.search.results_truncated
              ? ' Some matches were not returned.'
              : '';
            return openSolarSuccess(
              payload,
              `${payload.matches.length} projects. ${finished}${dropped}`,
            );
          } catch (error) {
            if (error instanceof BareListPageError) {
              return { isError: true, content: [{ type: 'text', text: error.message }] };
            }
            throw error;
          }
        }),
    );
  }

  if (enabled.has('get_project')) {
    server.registerTool(
      'get_project',
      {
        title: 'Get project',
        description:
          'Returns one project by id: address, stage, stage_milestone, workflow ids, contacts, assigned role, ' +
          'system_count, design_available, and events. Use it for fields a search row does not include. ' +
          'When search_projects reports `resolution: unique`, that target does not need this call before a write. ' +
          '`verbose: true` returns the full redacted object; `design` is `[REDACTED]`. API Access may omit design.',
        inputSchema: getProjectInputSchema,
        outputSchema: GetProjectOutputSchema,
        annotations: readAnnotations,
      },
      async ({ id, verbose }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/projects/${id}/`;
          const raw = await ctx.client.get(path);
          const project = ProjectFullSchema.parse(raw);
          if (verbose) {
            const payload = redactSensitive(project, DEFAULT_REDACTION);
            return openSolarSuccess(payload, `Full redacted project ${id}.`);
          }
          const payload = GetProjectCuratedSchema.parse(
            redactSensitive(curateProject(project), DEFAULT_REDACTION),
          );
          const title = payload.title ?? '';
          const summary = title === '' ? `Project ${id}.` : `Project ${id}: ${title}.`;
          return openSolarSuccess(payload, summary);
        }),
    );
  }

  if (enabled.has('get_project_snapshot')) {
    server.registerTool(
      'get_project_snapshot',
      {
        title: 'Get project snapshot',
        description:
          'Reads one project plus its workflow, systems, and file metadata. A section that fails is a gap, not an empty list. ' +
          'Design, file URLs, and configuration JSON are omitted. payment_option is included only when the project payload points at payment_option_sold. ' +
          'Usage keeps the source period. Daily-per-month values are not summed into an annual total. ' +
          'Systems are one page from the systems list. File titles come from private_files_data when the project includes it, otherwise one private-files page. ' +
          'returned_count is the titles in this response. total_count is null when that page is full.',
        inputSchema: z
          .object({
            project_id: z
              .number()
              .int()
              .positive()
              .describe('Project id from list_projects or search_projects.'),
          })
          .strict(),
        outputSchema: ProjectSnapshotSchema,
        annotations: readAnnotations,
      },
      async ({ project_id }) =>
        runOpenSolarTool(async () => {
          const snapshot = ProjectSnapshotSchema.parse(
            await loadProjectSnapshot(ctx.client, ctx.orgId, project_id),
          );
          const title = 'gap' in snapshot.project ? '' : (snapshot.project.title ?? '');
          const summary =
            title === '' ? `Project ${project_id}.` : `Project ${project_id}: ${title}.`;
          return openSolarSuccess(snapshot, summary);
        }),
    );
  }

  if (enabled.has('create_project')) {
    server.registerTool(
      'create_project',
      {
        title: 'Create project',
        description:
          'Creates a project in the live org. A new project can be blocked when the wallet is empty. ' +
          'API Access uses project-level paid entitlement while it is enabled. This call is not retried.',
        inputSchema: createProjectInputSchema,
        outputSchema: ProjectWriteResultSchema,
        annotations: createAnnotations,
      },
      async (input) =>
        runOpenSolarTool(async () => {
          const raw = await ctx.client.post(
            `orgs/${ctx.orgId}/projects/`,
            projectWriteBody(ctx, input, true),
          );
          return projectWriteResult(raw);
        }),
    );
  }

  if (enabled.has('update_project')) {
    server.registerTool(
      'update_project',
      {
        title: 'Update project',
        description:
          'Updates address, notes, and related fields on one project in the live org. ' +
          'Send at least one field besides id. Stage, design, workflow, and usage are not accepted. ' +
          'This call is not retried.',
        inputSchema: updateProjectInputSchema,
        outputSchema: ProjectWriteResultSchema,
        annotations: updateAnnotations,
      },
      async ({ id, ...fields }) =>
        runOpenSolarTool(async () => {
          const raw = await ctx.client.patch(
            `orgs/${ctx.orgId}/projects/${id}/`,
            projectWriteBody(ctx, fields, false),
          );
          return projectWriteResult(raw);
        }),
    );
  }

  if (enabled.has('update_project_stage')) {
    server.registerTool(
      'update_project_stage',
      {
        title: 'Update project stage',
        description:
          'Sets the workflow stage on a project in the live org. Send active_stage_id with workflow_id, or stage_name. ' +
          'A stage title is resolved on that workflow. No match or two matches with the same title do not PATCH. ' +
          'The deprecated stage field is not accepted. This call is not retried.',
        inputSchema: updateProjectStageInputSchema,
        outputSchema: ProjectStageResultSchema,
        annotations: updateAnnotations,
      },
      async ({ project_id, workflow_id, active_stage_id, stage_name }) =>
        runOpenSolarTool(async () => {
          if (active_stage_id !== undefined) {
            if (workflow_id === undefined) {
              return stageToolError('workflow_id is required with active_stage_id.');
            }
            const raw = await ctx.client.patch(
              `orgs/${ctx.orgId}/projects/${project_id}/`,
              projectStageBody(workflow_id, active_stage_id),
            );
            return projectStageResult(raw, workflow_id, active_stage_id);
          }
          if (stage_name === undefined) {
            return stageToolError('Send exactly one of active_stage_id or stage_name.');
          }
          const workflowId = workflow_id ?? (await projectWorkflowId(ctx, project_id));
          if (typeof workflowId !== 'number') {
            return workflowId;
          }
          const workflow = WorkflowSchema.parse(
            await ctx.client.get(`orgs/${ctx.orgId}/workflows/${workflowId}/`),
          );
          const resolved = resolveWorkflowStage(workflow.workflow_stages ?? [], stage_name);
          if (resolved.status === 'none') {
            const titles = resolved.titles.length > 0 ? resolved.titles.join(', ') : 'none';
            return stageToolError(
              `No stage titled "${stage_name}". Stages on this workflow: ${titles}.`,
            );
          }
          if (resolved.status === 'ambiguous') {
            return stageToolError(
              `More than one stage is titled "${stage_name}". Send active_stage_id.`,
            );
          }
          const raw = await ctx.client.patch(
            `orgs/${ctx.orgId}/projects/${project_id}/`,
            projectStageBody(workflowId, resolved.stageId),
          );
          return projectStageResult(raw, workflowId, resolved.stageId);
        }),
    );
  }

  if (enabled.has('update_project_usage')) {
    server.registerTool(
      'update_project_usage',
      {
        title: 'Update project usage',
        description:
          'Sets energy consumption on a project in the live org. Only the usage object is sent. ' +
          'values must match the source: one integer for annual, 12, 6, or 4 integers for the period sources, ' +
          'or Low, Medium, or High for estimate. This call is not retried.',
        inputSchema: updateProjectUsageInputSchema,
        outputSchema: ProjectUsageResultSchema,
        annotations: updateAnnotations,
      },
      async ({ project_id, usage_data_source, values }) =>
        runOpenSolarTool(async () => {
          const raw = await ctx.client.patch(
            `orgs/${ctx.orgId}/projects/${project_id}/`,
            projectUsageBody({ usage_data_source, values }),
          );
          return projectUsageResult(raw, usage_data_source);
        }),
    );
  }

  if (enabled.has('delete_project')) {
    server.registerTool(
      'delete_project',
      {
        title: 'Delete project',
        description: 'Removes the project from the live org. This call is not retried.',
        inputSchema: z
          .object({
            project_id: z.number().int().positive().describe('Project id from list_projects.'),
          })
          .strict(),
        outputSchema: DeletedRecordSchema,
        annotations: deleteAnnotations,
      },
      async ({ project_id }) =>
        runOpenSolarTool(async () => {
          await ctx.client.delete(`orgs/${ctx.orgId}/projects/${project_id}/`);
          const payload = DeletedRecordSchema.parse({ id: project_id, deleted: true });
          return openSolarSuccess(payload, `Project ${project_id} deleted.`);
        }),
    );
  }
}

function matchProject(
  query: string,
  item: unknown,
): (Record<string, unknown> & { match: ProjectMatch }) | null {
  const parsed = ProjectSummarySchema.safeParse(item);
  if (!parsed.success) {
    return null;
  }
  const redacted = redactSensitive(parsed.data, DEFAULT_REDACTION);
  const ranked = rankProject(query, projectMatchSource(redacted));
  if (ranked === null) {
    return null;
  }
  return { ...curateProjectListRow(parsed.data), match: ranked };
}

function projectMatchSource(value: unknown): ProjectMatchSource {
  const record = asRecord(value);
  if (record === null) {
    return {};
  }
  const contacts = Array.isArray(record.contacts_data)
    ? record.contacts_data.flatMap((entry) => {
        const contact = asRecord(entry);
        if (contact === null) {
          return [];
        }
        return [
          {
            email: stringField(contact.email),
            phone: stringField(contact.phone),
            first_name: stringField(contact.first_name),
            family_name: stringField(contact.family_name),
            display: stringField(contact.display),
          },
        ];
      })
    : [];
  return {
    title: stringField(record.title),
    address: stringField(record.address),
    identifier: stringField(record.identifier),
    business_name: stringField(record.business_name),
    locality: stringField(record.locality),
    state: stringField(record.state),
    zip: stringField(record.zip),
    contacts,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stageToolError(text: string): {
  isError: true;
  content: [{ type: 'text'; text: string }];
} {
  return { isError: true, content: [{ type: 'text', text }] };
}

async function projectWorkflowId(
  ctx: ProjectsContext,
  projectId: number,
): Promise<number | ReturnType<typeof stageToolError>> {
  const raw = await ctx.client.get(`orgs/${ctx.orgId}/projects/${projectId}/`);
  const project = ProjectFullSchema.parse(raw);
  const workflowId = project.workflow?.workflow_id;
  if (workflowId === undefined) {
    return stageToolError('This project has no workflow id. Send workflow_id.');
  }
  return workflowId;
}
