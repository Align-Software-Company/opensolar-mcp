import { z } from 'zod';

const webhookIdPattern = /\/webhooks\/(\d+)\/?/;

export function webhookIdFromReference(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = webhookIdPattern.exec(value);
  if (match?.[1] === undefined) {
    return null;
  }
  return Number(match[1]);
}

const fieldListSchema = z.array(z.string()).nullish();

export const WebhookSchema = z
  .object({
    id: z.number().int().positive(),
    endpoint: z.string().nullish(),
    enabled: z.boolean().nullish(),
    debug: z.boolean().nullish(),
    trigger_fields: fieldListSchema,
    payload_fields: fieldListSchema,
  })
  .passthrough();

export type Webhook = z.infer<typeof WebhookSchema>;

export const CuratedWebhookSchema = z.object({
  id: z.number().int().positive(),
  endpoint: z.string().nullable(),
  enabled: z.boolean().nullable(),
  debug: z.boolean().nullable(),
  trigger_fields: z.array(z.string()).nullable(),
  payload_fields: z.array(z.string()).nullable(),
});

export type CuratedWebhook = z.infer<typeof CuratedWebhookSchema>;

export function curateWebhook(webhook: Webhook): CuratedWebhook {
  return {
    id: webhook.id,
    endpoint: webhook.endpoint ?? null,
    enabled: webhook.enabled ?? null,
    debug: webhook.debug ?? null,
    trigger_fields: webhook.trigger_fields ?? null,
    payload_fields: webhook.payload_fields ?? null,
  };
}

export const WebhookListSchema = z.array(WebhookSchema);

export const ListWebhooksOutputSchema = z.object({
  webhooks: z.array(CuratedWebhookSchema),
});

export const WebhookLogSchema = z
  .object({
    id: z.number().int().positive(),
    webhook: z.union([z.string(), z.number()]).nullish(),
    event_queue_name: z.string().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    event_timestamp: z.string().nullish(),
  })
  .passthrough();

export type WebhookLog = z.infer<typeof WebhookLogSchema>;

export const CuratedWebhookLogSchema = z.object({
  id: z.number().int().positive(),
  webhook_id: z.number().int().positive().nullable(),
  event_queue_name: z.string().nullable(),
  created_date: z.string().nullable(),
  modified_date: z.string().nullable(),
  event_timestamp: z.string().nullable(),
});

export function curateWebhookLog(log: WebhookLog): z.infer<typeof CuratedWebhookLogSchema> {
  return {
    id: log.id,
    webhook_id: webhookIdFromReference(log.webhook),
    event_queue_name: log.event_queue_name ?? null,
    created_date: log.created_date ?? null,
    modified_date: log.modified_date ?? null,
    event_timestamp: log.event_timestamp ?? null,
  };
}

export const WebhookLogListSchema = z.array(WebhookLogSchema);

export const ListWebhookLogsOutputSchema = z.object({
  webhook_logs: z.array(CuratedWebhookLogSchema),
  page: z.number().int(),
  limit: z.number().int(),
});

export const WebhookQueueSchema = z
  .object({
    id: z.number().int().positive(),
    webhook: z.union([z.string(), z.number()]).nullish(),
    event_queue_name: z.string().nullish(),
    next_attempt_at: z.string().nullish(),
    processing_started_at: z.string().nullish(),
  })
  .passthrough();

export type WebhookQueueItem = z.infer<typeof WebhookQueueSchema>;

export const CuratedWebhookQueueSchema = z.object({
  id: z.number().int().positive(),
  webhook_id: z.number().int().positive().nullable(),
  event_queue_name: z.string().nullable(),
  next_attempt_at: z.string().nullable(),
  processing_started_at: z.string().nullable(),
});

export function curateWebhookQueueItem(
  item: WebhookQueueItem,
): z.infer<typeof CuratedWebhookQueueSchema> {
  return {
    id: item.id,
    webhook_id: webhookIdFromReference(item.webhook),
    event_queue_name: item.event_queue_name ?? null,
    next_attempt_at: item.next_attempt_at ?? null,
    processing_started_at: item.processing_started_at ?? null,
  };
}

export const WebhookQueueListSchema = z.array(WebhookQueueSchema);

export const ListWebhookQueueOutputSchema = z.object({
  webhook_queue: z.array(CuratedWebhookQueueSchema),
  page: z.number().int(),
  limit: z.number().int(),
});
