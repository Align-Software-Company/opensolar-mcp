import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  CostingListSchema,
  CostingRowSchema,
  CostingSchema,
  curateCosting,
  ListCostingsOutputSchema,
} from '../schemas/costing.js';
import { DeletedRecordSchema } from '../schemas/project.js';

export interface CostingContext {
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

const costingIdInput = z
  .object({
    id: z.number().int().positive().describe('Costing id. Use list_costings to discover ids.'),
  })
  .strict();

const listCostingsInputSchema = z.object({
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum costings per page. Defaults to 20, capped at 100.'),
  priority: z
    .boolean()
    .optional()
    .describe('When set, keep only costings with this priority flag. Priority is true or false.'),
});

export function registerCostingToolset(
  server: McpServer,
  ctx: CostingContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_costings')) {
    registerListCostings(server, ctx);
  }
  if (enabled.has('get_costing')) {
    registerGetCosting(server, ctx);
  }
  if (enabled.has('delete_costing')) {
    registerDeleteCosting(server, ctx);
  }
}

function registerListCostings(server: McpServer, ctx: CostingContext): void {
  server.registerTool(
    'list_costings',
    {
      title: 'List costings',
      description:
        'Lists one page of costings as `{ costings, page, limit }`. ' +
        'The only optional filter is boolean priority. Per-unit rates are omitted.',
      inputSchema: listCostingsInputSchema,
      outputSchema: ListCostingsOutputSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit, priority }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (priority !== undefined) {
          params.set('priority', String(priority));
        }
        const path = `orgs/${ctx.orgId}/costings/?${params.toString()}`;
        const raw = await ctx.client.get(path);
        const costings = CostingListSchema.parse(raw).map(curateCosting);
        const payload = ListCostingsOutputSchema.parse({ costings, page, limit });
        return openSolarSuccess(
          payload,
          `${payload.costings.length} costings on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function registerGetCosting(server: McpServer, ctx: CostingContext): void {
  server.registerTool(
    'get_costing',
    {
      title: 'Get costing',
      description:
        'Returns one costing by id: title, description, and boolean priority. Per-unit rates are omitted.',
      inputSchema: costingIdInput,
      outputSchema: CostingRowSchema,
      annotations: readAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/costings/${id}/`;
        const raw = await ctx.client.get(path);
        const payload = CostingRowSchema.parse(curateCosting(CostingSchema.parse(raw)));
        const title = payload.title ?? '';
        const summary = title === '' ? `Costing ${id}.` : `Costing ${id}: ${title}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerDeleteCosting(server: McpServer, ctx: CostingContext): void {
  server.registerTool(
    'delete_costing',
    {
      title: 'Delete costing',
      description: 'Removes the costing from the live org. This call is not retried.',
      inputSchema: costingIdInput,
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/costings/${id}/`);
        const payload = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(payload, `Delete costing ${id}.`);
      }),
  );
}
