import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  curatePaymentOption,
  ListPaymentOptionsOutputSchema,
  PAYMENT_TYPES,
  PaymentOptionListSchema,
  PaymentOptionRowSchema,
  PaymentOptionSchema,
} from '../schemas/payment.js';
import { DeletedRecordSchema } from '../schemas/project.js';

export interface PaymentContext {
  client: OpenSolarClient;
  orgId: number;
}

const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const paymentOptionIdInput = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Payment option id. Use list_payment_options to discover ids.'),
  })
  .strict();

const listPaymentOptionsInputSchema = z.object({
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum payment options per page. Defaults to 20, capped at 100.'),
  payment_type: z
    .enum(PAYMENT_TYPES)
    .optional()
    .describe('Filter by payment type: cash, loan, loan_advanced, ppa, regular_payment, or lease.'),
  auto_apply_enabled: z
    .boolean()
    .optional()
    .describe('When set, keep only options with this auto-apply flag.'),
  priority: z.number().int().optional().describe('When set, keep only options with this priority.'),
});

export function registerPaymentToolset(
  server: McpServer,
  ctx: PaymentContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_payment_options')) {
    registerListPaymentOptions(server, ctx);
  }
  if (enabled.has('get_payment_option')) {
    registerGetPaymentOption(server, ctx);
  }
  if (enabled.has('delete_payment_option')) {
    registerDeletePaymentOption(server, ctx);
  }
}

function registerListPaymentOptions(server: McpServer, ctx: PaymentContext): void {
  server.registerTool(
    'list_payment_options',
    {
      title: 'List payment options',
      description:
        'Lists one page of payment options as `{ payment_options, page, limit }`. ' +
        'Optional filters are payment_type, auto_apply_enabled, and priority. `configuration_json` is omitted.',
      inputSchema: listPaymentOptionsInputSchema,
      outputSchema: ListPaymentOptionsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ page, limit, payment_type, auto_apply_enabled, priority }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (payment_type !== undefined) {
          params.set('payment_type', payment_type);
        }
        if (auto_apply_enabled !== undefined) {
          params.set('auto_apply_enabled', String(auto_apply_enabled));
        }
        if (priority !== undefined) {
          params.set('priority', String(priority));
        }
        const path = `orgs/${ctx.orgId}/payment_options/?${params.toString()}`;
        const raw = await ctx.client.get(path);
        const paymentOptions = PaymentOptionListSchema.parse(raw).map(curatePaymentOption);
        const payload = ListPaymentOptionsOutputSchema.parse({
          payment_options: paymentOptions,
          page,
          limit,
        });
        return openSolarSuccess(
          payload,
          `${payload.payment_options.length} payment options on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function registerGetPaymentOption(server: McpServer, ctx: PaymentContext): void {
  server.registerTool(
    'get_payment_option',
    {
      title: 'Get payment option',
      description:
        'Returns one payment option by id: title, payment type, priority, auto-apply, and archived. `configuration_json` is omitted.',
      inputSchema: paymentOptionIdInput,
      outputSchema: PaymentOptionRowSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/payment_options/${id}/`;
        const raw = await ctx.client.get(path);
        const payload = PaymentOptionRowSchema.parse(
          curatePaymentOption(PaymentOptionSchema.parse(raw)),
        );
        const title = payload.title ?? '';
        const summary = title === '' ? `Payment option ${id}.` : `Payment option ${id}: ${title}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerDeletePaymentOption(server: McpServer, ctx: PaymentContext): void {
  server.registerTool(
    'delete_payment_option',
    {
      title: 'Delete payment option',
      description: 'Removes the payment option from the live org. This call is not retried.',
      inputSchema: paymentOptionIdInput,
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/payment_options/${id}/`);
        const payload = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(payload, `Delete payment option ${id}.`);
      }),
  );
}
