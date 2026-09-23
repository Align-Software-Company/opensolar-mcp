import { z } from 'zod';

const positiveId = z.number().int().positive();

const shareResources = [
  'payment_option',
  'pricing_scheme',
  'costing',
  'component_module_activation',
  'component_inverter_activation',
  'component_battery_activation',
  'component_other_activation',
] as const;

const ShareResourceRowSchema = z
  .object({
    resource: z.enum(shareResources),
    referenced: z.enum(['yes', 'no', 'unknown']),
    ids: z.array(positiveId),
    share: z.enum(['shared', 'not_shared', 'unknown']),
    gap: z.string().optional(),
  })
  .strict();

export const PreflightProjectShareSchema = z
  .object({
    project_id: positiveId,
    target_org_id: positiveId,
    connection: z
      .object({
        status: z.enum(['active', 'inactive', 'not_connected', 'ambiguous', 'unknown']),
        connection_id: positiveId.optional(),
        connection_ids: z.array(positiveId).optional(),
        is_active: z.boolean().nullable().optional(),
        is_other_active: z.boolean().nullable().optional(),
        is_other_enabled: z.boolean().nullable().optional(),
        list_complete: z.boolean(),
        gap: z.string().optional(),
      })
      .strict(),
    project_share: z
      .object({
        status: z.enum(['shared', 'not_shared', 'unknown']),
        gap: z.string().optional(),
      })
      .strict(),
    systems_list_complete: z.boolean(),
    resources: z.array(ShareResourceRowSchema),
  })
  .strict();

export type PreflightProjectShare = z.infer<typeof PreflightProjectShareSchema>;
export type ShareResource = (typeof shareResources)[number];
