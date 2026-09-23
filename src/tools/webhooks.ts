import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { WEBHOOK_FIELD_PATHS } from '../lib/enums/webhook-fields.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  CuratedWebhookSchema,
  curateWebhook,
  curateWebhookLog,
  curateWebhookQueueItem,
  ListWebhookLogsOutputSchema,
  ListWebhookQueueOutputSchema,
  ListWebhooksOutputSchema,
  WebhookListSchema,
  WebhookLogListSchema,
  WebhookQueueListSchema,
  WebhookSchema,
} from '../schemas/webhook.js';

export interface WebhookContext {
  client: OpenSolarClient;
  orgId: number;
}

const FAIR_USE =
  "OpenSolar's User Terms limit webhook calls to 2,000 a month unless a commercial plan or written agreement says otherwise. This server does not count them.";

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

const fieldPaths = z
  .array(z.enum(WEBHOOK_FIELD_PATHS))
  .describe(
    'Field paths from the webhooks page. Leave unset on create to use OpenSolar defaults. project.*, event.*, and contact.* together are broader than most callers want.',
  );

const webhookFields = {
  endpoint: z.string().min(1).describe('URL that receives the webhook.'),
  enabled: z.boolean().describe('Whether the webhook is active.'),
  debug: z.boolean().describe('Required on create. OpenSolar currently does not use this flag.'),
  trigger_fields: fieldPaths.optional(),
  payload_fields: fieldPaths.optional(),
};

const createWebhookInput = z
  .object({
    endpoint: webhookFields.endpoint,
    enabled: webhookFields.enabled,
    debug: webhookFields.debug,
    trigger_fields: webhookFields.trigger_fields,
    payload_fields: webhookFields.payload_fields,
  })
  .strict();

const updateWebhookInput = z
  .object({
    id: z.number().int().positive().describe('Webhook id. Use list_webhooks to discover ids.'),
    endpoint: webhookFields.endpoint.optional(),
    enabled: webhookFields.enabled.optional(),
    debug: webhookFields.debug.optional(),
    trigger_fields: webhookFields.trigger_fields,
    payload_fields: webhookFields.payload_fields,
  })
  .strict()
  .refine(
    (value) => Object.entries(value).some(([key, field]) => key !== 'id' && field !== undefined),
    { message: 'At least one field besides id is required' },
  );

const pageLimitFields = {
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum rows per page. Defaults to 20, capped at 100.'),
};

const listWebhookLogsInput = z.object({
  ...pageLimitFields,
  search: z.string().min(1).optional().describe('When set, keep logs that contain this term.'),
});

const listWebhookQueueInput = z.object(pageLimitFields);

export function registerWebhooksToolset(
  server: McpServer,
  ctx: WebhookContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_webhooks')) {
    registerListWebhooks(server, ctx);
  }
  if (enabled.has('create_webhook')) {
    registerCreateWebhook(server, ctx);
  }
  if (enabled.has('update_webhook')) {
    registerUpdateWebhook(server, ctx);
  }
  if (enabled.has('list_webhook_logs')) {
    registerListWebhookLogs(server, ctx);
  }
  if (enabled.has('list_webhook_queue')) {
    registerListWebhookQueue(server, ctx);
  }
}

function registerListWebhooks(server: McpServer, ctx: WebhookContext): void {
  server.registerTool(
    'list_webhooks',
    {
      title: 'List webhooks',
      description:
        'Lists the org webhooks as `{ webhooks }`. Each webhook is id, endpoint, enabled, debug, trigger_fields, and payload_fields. ' +
        `The webhooks page does not document paging. ${FAIR_USE}`,
      inputSchema: z.object({}).strict(),
      outputSchema: ListWebhooksOutputSchema,
      annotations: readAnnotations,
    },
    async () =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.get(`orgs/${ctx.orgId}/webhooks/`);
        const webhooks = WebhookListSchema.parse(raw).map(curateWebhook);
        const payload = ListWebhooksOutputSchema.parse({ webhooks });
        return openSolarSuccess(payload, `${payload.webhooks.length} webhooks.`);
      }),
  );
}

function registerCreateWebhook(server: McpServer, ctx: WebhookContext): void {
  server.registerTool(
    'create_webhook',
    {
      title: 'Create webhook',
      description:
        'Creates a webhook in the live org. Requires endpoint, enabled, and debug. ' +
        'Leave trigger_fields and payload_fields unset to use OpenSolar defaults. ' +
        'project.* plus event.* plus contact.* is broader than most callers want. This call is not retried. ' +
        FAIR_USE,
      inputSchema: createWebhookInput,
      outputSchema: CuratedWebhookSchema,
      annotations: createAnnotations,
    },
    async (input) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.post(`orgs/${ctx.orgId}/webhooks/`, webhookWriteBody(input));
        const payload = CuratedWebhookSchema.parse(curateWebhook(WebhookSchema.parse(raw)));
        return openSolarSuccess(payload, `Webhook ${payload.id}.`);
      }),
  );
}

function registerUpdateWebhook(server: McpServer, ctx: WebhookContext): void {
  server.registerTool(
    'update_webhook',
    {
      title: 'Update webhook',
      description:
        'Updates a webhook in the live org. A blank trigger_fields or payload_fields on an existing webhook is treated as null. ' +
        `This call is not retried. ${FAIR_USE}`,
      inputSchema: updateWebhookInput,
      outputSchema: CuratedWebhookSchema,
      annotations: updateAnnotations,
    },
    async ({ id, ...fields }) =>
      runOpenSolarTool(async () => {
        const raw = await ctx.client.patch(
          `orgs/${ctx.orgId}/webhooks/${id}/`,
          webhookWriteBody(fields),
        );
        const payload = CuratedWebhookSchema.parse(curateWebhook(WebhookSchema.parse(raw)));
        return openSolarSuccess(payload, `Webhook ${payload.id}.`);
      }),
  );
}

function registerListWebhookLogs(server: McpServer, ctx: WebhookContext): void {
  server.registerTool(
    'list_webhook_logs',
    {
      title: 'List webhook logs',
      description:
        'Lists one page of webhook logs as `{ webhook_logs, page, limit }`. ' +
        'Each row is id, webhook_id, event_queue_name, created_date, modified_date, and event_timestamp. ' +
        `An empty page can return HTTP 500. ${FAIR_USE}`,
      inputSchema: listWebhookLogsInput,
      outputSchema: ListWebhookLogsOutputSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit, search }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (search !== undefined) {
          params.set('search', search);
        }
        const raw = await ctx.client.get(
          `orgs/${ctx.orgId}/webhook_process_logs/?${params.toString()}`,
        );
        const webhookLogs = WebhookLogListSchema.parse(raw).map(curateWebhookLog);
        const payload = ListWebhookLogsOutputSchema.parse({
          webhook_logs: webhookLogs,
          page,
          limit,
        });
        return openSolarSuccess(
          payload,
          `${payload.webhook_logs.length} webhook logs on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function registerListWebhookQueue(server: McpServer, ctx: WebhookContext): void {
  server.registerTool(
    'list_webhook_queue',
    {
      title: 'List webhook queue',
      description:
        'Lists one page of the webhook queue as `{ webhook_queue, page, limit }`. ' +
        'Each row is id, webhook_id, model_name, event, number_of_attempts, next_attempt_at, and processing_started_at. ' +
        FAIR_USE,
      inputSchema: listWebhookQueueInput,
      outputSchema: ListWebhookQueueOutputSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit }) =>
      runOpenSolarTool(async () => {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        const raw = await ctx.client.get(
          `orgs/${ctx.orgId}/webhook_queue_models/?${params.toString()}`,
        );
        const webhookQueue = WebhookQueueListSchema.parse(raw).map(curateWebhookQueueItem);
        const payload = ListWebhookQueueOutputSchema.parse({
          webhook_queue: webhookQueue,
          page,
          limit,
        });
        return openSolarSuccess(
          payload,
          `${payload.webhook_queue.length} queued webhooks on page ${payload.page} (limit ${payload.limit}).`,
        );
      }),
  );
}

function webhookWriteBody(input: {
  endpoint?: string;
  enabled?: boolean;
  debug?: boolean;
  trigger_fields?: readonly string[];
  payload_fields?: readonly string[];
}): {
  endpoint?: string;
  enabled?: boolean;
  debug?: boolean;
  trigger_fields?: readonly string[];
  payload_fields?: readonly string[];
} {
  return {
    ...(input.endpoint !== undefined ? { endpoint: input.endpoint } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.debug !== undefined ? { debug: input.debug } : {}),
    ...(input.trigger_fields !== undefined ? { trigger_fields: input.trigger_fields } : {}),
    ...(input.payload_fields !== undefined ? { payload_fields: input.payload_fields } : {}),
  };
}
