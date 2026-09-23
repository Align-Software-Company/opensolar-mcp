import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  ActivationListSchema,
  ActivationRowSchema,
  ActivationSchema,
  activationListOutputSchema,
  curateActivation,
} from '../schemas/component.js';
import { DeletedRecordSchema } from '../schemas/project.js';

export interface ComponentsContext {
  client: OpenSolarClient;
  orgId: number;
}

const pageLimitInput = {
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum rows per page. Defaults to 20, capped at 100.'),
};

const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const componentKinds = [
  {
    listName: 'list_modules',
    getName: 'get_module',
    deleteName: 'delete_module_activation',
    listTitle: 'List modules',
    getTitle: 'Get module',
    deleteTitle: 'Delete module activation',
    segment: 'component_module_activations',
    outputKey: 'modules',
    noun: 'modules',
    singular: 'module',
  },
  {
    listName: 'list_inverters',
    getName: 'get_inverter',
    deleteName: 'delete_inverter_activation',
    listTitle: 'List inverters',
    getTitle: 'Get inverter',
    deleteTitle: 'Delete inverter activation',
    segment: 'component_inverter_activations',
    outputKey: 'inverters',
    noun: 'inverters',
    singular: 'inverter',
  },
  {
    listName: 'list_batteries',
    getName: 'get_battery',
    deleteName: 'delete_battery_activation',
    listTitle: 'List batteries',
    getTitle: 'Get battery',
    deleteTitle: 'Delete battery activation',
    segment: 'component_battery_activations',
    outputKey: 'batteries',
    noun: 'batteries',
    singular: 'battery',
  },
  {
    listName: 'list_other_components',
    getName: 'get_other_component',
    deleteName: 'delete_other_component_activation',
    listTitle: 'List other components',
    getTitle: 'Get other component',
    deleteTitle: 'Delete other component activation',
    segment: 'component_other_activations',
    outputKey: 'other_components',
    noun: 'other components',
    singular: 'other component',
  },
] as const satisfies readonly {
  listName: ToolName;
  getName: ToolName;
  deleteName: ToolName;
  listTitle: string;
  getTitle: string;
  deleteTitle: string;
  segment: string;
  outputKey: 'modules' | 'inverters' | 'batteries' | 'other_components';
  noun: string;
  singular: string;
}[];

const activationIdInput = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('Activation id. Use the matching list tool to discover ids.'),
});

export function registerComponentsToolset(
  server: McpServer,
  ctx: ComponentsContext,
  enabled: ReadonlySet<ToolName>,
): void {
  for (const entry of componentKinds) {
    if (enabled.has(entry.listName)) {
      registerComponentList(server, ctx, entry);
    }
    if (enabled.has(entry.getName)) {
      registerComponentDetail(server, ctx, entry);
    }
    if (enabled.has(entry.deleteName)) {
      registerComponentDelete(server, ctx, entry);
    }
  }
}

function registerComponentList(
  server: McpServer,
  ctx: ComponentsContext,
  entry: (typeof componentKinds)[number],
): void {
  const outputSchema = activationListOutputSchema(entry.outputKey);
  server.registerTool(
    entry.listName,
    {
      title: entry.listTitle,
      description:
        `Lists one page of activated ${entry.noun} as \`{ ${entry.outputKey}, page, limit }\`. ` +
        'Each row is id, code, manufacturer, is_default, and is_archived. The spec blob in `data` is omitted.',
      inputSchema: z.object(pageLimitInput),
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, limit }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        const path = `orgs/${ctx.orgId}/${entry.segment}/?${params.toString()}`;
        const raw = await ctx.client.get(path);
        const rows = ActivationListSchema.parse(raw).map(curateActivation);
        const payload = outputSchema.parse({
          [entry.outputKey]: rows,
          page,
          limit,
        });
        return openSolarSuccess(
          payload,
          `${rows.length} ${entry.noun} on page ${page} (limit ${limit}).`,
        );
      }),
  );
}

function registerComponentDetail(
  server: McpServer,
  ctx: ComponentsContext,
  entry: (typeof componentKinds)[number],
): void {
  server.registerTool(
    entry.getName,
    {
      title: entry.getTitle,
      description:
        `Returns one activated ${entry.singular} by id: id, code, manufacturer, is_default, and is_archived. ` +
        'The spec blob in `data` is omitted.',
      inputSchema: activationIdInput,
      outputSchema: ActivationRowSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/${entry.segment}/${id}/`;
        const raw = await ctx.client.get(path);
        const payload = ActivationRowSchema.parse(curateActivation(ActivationSchema.parse(raw)));
        const code = payload.code ?? '';
        const summary =
          code === '' ? `${entry.getTitle} ${id}.` : `${entry.getTitle} ${id}: ${code}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerComponentDelete(
  server: McpServer,
  ctx: ComponentsContext,
  entry: (typeof componentKinds)[number],
): void {
  server.registerTool(
    entry.deleteName,
    {
      title: entry.deleteTitle,
      description: `Removes an activated ${entry.singular} from the live org's design catalog. This call is not retried.`,
      inputSchema: activationIdInput.strict(),
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/${entry.segment}/${id}/`);
        const payload = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(payload, `${entry.deleteTitle} ${id}.`);
      }),
  );
}
