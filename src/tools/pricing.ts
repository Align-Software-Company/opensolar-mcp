import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  curatePricingScheme,
  ListPricingSchemesOutputSchema,
  PRICING_FORMULAS,
  PricingSchemeListSchema,
  PricingSchemeRowSchema,
  PricingSchemeSchema,
} from '../schemas/pricing.js';
import { DeletedRecordSchema } from '../schemas/project.js';

export interface PricingContext {
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

const pricingSchemeIdInput = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Pricing scheme id. Use list_pricing_schemes to discover ids.'),
  })
  .strict();

const listPricingSchemesInputSchema = z.object({
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum pricing schemes per page. Defaults to 20, capped at 100.'),
  priority: z.number().int().optional().describe('When set, keep only schemes with this priority.'),
  auto_apply_enabled: z
    .boolean()
    .optional()
    .describe('When set, keep only schemes with this auto-apply flag.'),
  pricing_formula: z
    .enum(PRICING_FORMULAS)
    .optional()
    .describe(
      'Filter by formula: Markup Percentage, Price Per Watt, Price Per Watt By Size, or Fixed Price.',
    ),
});

export function registerPricingToolset(
  server: McpServer,
  ctx: PricingContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_pricing_schemes')) {
    registerListPricingSchemes(server, ctx);
  }
  if (enabled.has('get_pricing_scheme')) {
    registerGetPricingScheme(server, ctx);
  }
  if (enabled.has('delete_pricing_scheme')) {
    registerDeletePricingScheme(server, ctx);
  }
}

function registerListPricingSchemes(server: McpServer, ctx: PricingContext): void {
  server.registerTool(
    'list_pricing_schemes',
    {
      title: 'List pricing schemes',
      description:
        'Lists one page of pricing schemes as `{ pricing_schemes, page, limit }`. ' +
        'Optional filters are priority, auto_apply_enabled, and pricing_formula. `configuration_json` is omitted.',
      inputSchema: listPricingSchemesInputSchema,
      outputSchema: ListPricingSchemesOutputSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit, priority, auto_apply_enabled, pricing_formula }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (priority !== undefined) {
          params.set('priority', String(priority));
        }
        if (auto_apply_enabled !== undefined) {
          params.set('auto_apply_enabled', String(auto_apply_enabled));
        }
        if (pricing_formula !== undefined) {
          params.set('pricing_formula', pricing_formula);
        }
        const path = `orgs/${ctx.orgId}/pricing_schemes/?${params.toString()}`;
        const raw = await ctx.client.get(path);
        const pricingSchemes = PricingSchemeListSchema.parse(raw).map(curatePricingScheme);
        const payload = ListPricingSchemesOutputSchema.parse({
          pricing_schemes: pricingSchemes,
          page,
          limit,
        });
        return openSolarSuccess(
          payload,
          `${payload.pricing_schemes.length} pricing schemes on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function registerGetPricingScheme(server: McpServer, ctx: PricingContext): void {
  server.registerTool(
    'get_pricing_scheme',
    {
      title: 'Get pricing scheme',
      description:
        'Returns one pricing scheme by id: title, formula, priority, auto-apply, and archived. `configuration_json` is omitted.',
      inputSchema: pricingSchemeIdInput,
      outputSchema: PricingSchemeRowSchema,
      annotations: readAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/pricing_schemes/${id}/`;
        const raw = await ctx.client.get(path);
        const payload = PricingSchemeRowSchema.parse(
          curatePricingScheme(PricingSchemeSchema.parse(raw)),
        );
        const title = payload.title ?? '';
        const summary = title === '' ? `Pricing scheme ${id}.` : `Pricing scheme ${id}: ${title}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerDeletePricingScheme(server: McpServer, ctx: PricingContext): void {
  server.registerTool(
    'delete_pricing_scheme',
    {
      title: 'Delete pricing scheme',
      description: 'Removes the pricing scheme from the live org. This call is not retried.',
      inputSchema: pricingSchemeIdInput,
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/pricing_schemes/${id}/`);
        const payload = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(payload, `Delete pricing scheme ${id}.`);
      }),
  );
}
