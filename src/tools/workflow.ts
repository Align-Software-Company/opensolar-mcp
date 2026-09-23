import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import { DeletedRecordSchema } from '../schemas/project.js';
import {
  CuratedWorkflowSchema,
  curateWorkflow,
  ListWorkflowsOutputSchema,
  WorkflowListSchema,
  WorkflowSchema,
} from '../schemas/workflow.js';

export interface WorkflowContext {
  client: OpenSolarClient;
  orgId: number;
}

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;

const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

const workflowIdInput = z
  .object({
    id: z.number().int().positive().describe('Workflow id. Use list_workflows to discover ids.'),
  })
  .strict();

const createWorkflowInput = z
  .object({
    title: z.string().min(1).describe('Workflow title.'),
    is_default: z
      .boolean()
      .optional()
      .describe('When true, this becomes the org default workflow.'),
    description: z.string().optional().describe('Workflow description.'),
  })
  .strict();

const listWorkflowsInputSchema = z.object({
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum workflows per page. Defaults to 20, capped at 100.'),
});

export function registerWorkflowToolset(
  server: McpServer,
  ctx: WorkflowContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_workflows')) {
    registerListWorkflows(server, ctx);
  }
  if (enabled.has('get_workflow')) {
    registerGetWorkflow(server, ctx);
  }
  if (enabled.has('create_workflow')) {
    registerCreateWorkflow(server, ctx);
  }
  if (enabled.has('delete_workflow')) {
    registerDeleteWorkflow(server, ctx);
  }
}

function registerListWorkflows(server: McpServer, ctx: WorkflowContext): void {
  server.registerTool(
    'list_workflows',
    {
      title: 'List workflows',
      description:
        'Lists one page of workflows as `{ workflows, page, limit }`. Each stage includes id, title, milestone, order, and is_archived. ' +
        'Use a stage id as active_stage_id. Actions are omitted.',
      inputSchema: listWorkflowsInputSchema,
      outputSchema: ListWorkflowsOutputSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        const path = `orgs/${ctx.orgId}/workflows/?${params.toString()}`;
        const raw = await ctx.client.get(path);
        const workflows = WorkflowListSchema.parse(raw).map(curateWorkflow);
        const payload = ListWorkflowsOutputSchema.parse({ workflows, page, limit });
        return openSolarSuccess(
          payload,
          `${payload.workflows.length} workflows on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function registerGetWorkflow(server: McpServer, ctx: WorkflowContext): void {
  server.registerTool(
    'get_workflow',
    {
      title: 'Get workflow',
      description:
        'Returns one workflow by id, including stage id, title, milestone, order, and is_archived. Actions are omitted. ' +
        'Use a stage id as active_stage_id.',
      inputSchema: workflowIdInput,
      outputSchema: CuratedWorkflowSchema,
      annotations: readAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/workflows/${id}/`;
        const raw = await ctx.client.get(path);
        const payload = CuratedWorkflowSchema.parse(curateWorkflow(WorkflowSchema.parse(raw)));
        const title = payload.title ?? '';
        const summary = title === '' ? `Workflow ${id}.` : `Workflow ${id}: ${title}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerCreateWorkflow(server: McpServer, ctx: WorkflowContext): void {
  server.registerTool(
    'create_workflow',
    {
      title: 'Create workflow',
      description:
        'Creates a workflow in the live org. OpenSolar assigns the stages. Actions are omitted from the result. This call is not retried.',
      inputSchema: createWorkflowInput,
      outputSchema: CuratedWorkflowSchema,
      annotations: createAnnotations,
    },
    async ({ title, is_default, description }) =>
      runOpenSolarTool(async () => {
        const body = {
          title,
          ...(is_default !== undefined ? { is_default } : {}),
          ...(description !== undefined ? { description } : {}),
        };
        const raw = await ctx.client.post(`orgs/${ctx.orgId}/workflows/`, body);
        const payload = CuratedWorkflowSchema.parse(curateWorkflow(WorkflowSchema.parse(raw)));
        const createdTitle = payload.title ?? title;
        return openSolarSuccess(payload, `Workflow ${payload.id}: ${createdTitle}.`);
      }),
  );
}

function registerDeleteWorkflow(server: McpServer, ctx: WorkflowContext): void {
  server.registerTool(
    'delete_workflow',
    {
      title: 'Delete workflow',
      description: 'Removes the workflow from the live org. This call is not retried.',
      inputSchema: workflowIdInput,
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/workflows/${id}/`);
        const payload = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(payload, `Delete workflow ${id}.`);
      }),
  );
}
