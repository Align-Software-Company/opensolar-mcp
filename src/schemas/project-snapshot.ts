import { z } from 'zod';
import { CuratedProjectEventSchema } from './event.js';
import { PaymentOptionRowSchema } from './payment.js';

export const SnapshotGapSchema = z
  .object({
    gap: z.string(),
  })
  .strict();

const SnapshotProjectSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    address: z.string().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    stage_milestone: z.string().optional(),
  })
  .strict();

const SnapshotContactSchema = z
  .object({
    id: z.number(),
    display: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    is_synthetic_email: z.boolean(),
  })
  .strict();

const SnapshotWorkflowSchema = z
  .object({
    workflow_id: z.number(),
    title: z.string().nullish(),
    active_stage_id: z.number().optional(),
    active_stage_title: z.string().nullish(),
    milestone: z.string().optional(),
  })
  .strict();

const SnapshotRoleSchema = z
  .object({
    display: z.string().nullish(),
  })
  .strict();

const SnapshotUsageSchema = z
  .object({
    usage_data_source: z.string(),
    period: z
      .enum(['annual', 'monthly', 'bimonthly', 'quarterly', 'daily_per_month', 'estimate'])
      .optional(),
    unit: z.enum(['kwh', 'bill']).optional(),
    period_count: z.number().int().positive().optional(),
    values: z.array(z.number()).optional(),
    annual_total: z.number().optional(),
    estimate: z.string().optional(),
  })
  .strict();

const SnapshotSystemSchema = z
  .object({
    id: z.number(),
    uuid: z.string().nullish(),
    name: z.string().nullish(),
    kw_stc: z.number().nullish(),
    module_quantity: z.number().nullish(),
    battery_total_kwh: z.number().nullish(),
    output_annual_kwh: z.number().nullish(),
  })
  .strict();

const SnapshotSystemsSchema = z
  .object({
    systems: z.array(SnapshotSystemSchema),
    list_complete: z.boolean(),
  })
  .strict();

const SnapshotEventSchema = CuratedProjectEventSchema.pick({
  id: true,
  event_type_id: true,
  event_type_name: true,
  title: true,
  start: true,
  created_date: true,
}).strict();

const SnapshotFileSchema = z
  .object({
    title: z.string().nullish(),
    file_tags: z.array(z.string()),
  })
  .strict();

const SnapshotFilesSchema = z
  .object({
    returned_count: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative().nullable(),
    list_complete: z.boolean(),
    files: z.array(SnapshotFileSchema),
  })
  .strict();

const SnapshotShareSchema = z
  .object({
    org_id: z.number().optional(),
    is_shared: z.boolean().optional(),
  })
  .strict();

const SnapshotPaymentSchema = PaymentOptionRowSchema.pick({
  id: true,
  title: true,
  payment_type: true,
}).strict();

export const ProjectSnapshotSchema = z
  .object({
    project: z.union([SnapshotProjectSchema, SnapshotGapSchema]),
    contacts: z.union([z.array(SnapshotContactSchema), SnapshotGapSchema]),
    workflow: z.union([SnapshotWorkflowSchema, SnapshotGapSchema]).optional(),
    assigned_role: SnapshotRoleSchema.optional(),
    usage: SnapshotUsageSchema.optional(),
    systems: z.union([SnapshotSystemsSchema, SnapshotGapSchema]),
    payment_option: z.union([SnapshotPaymentSchema, SnapshotGapSchema]).optional(),
    events: z.union([z.array(SnapshotEventSchema), SnapshotGapSchema]).optional(),
    files: z.union([SnapshotFilesSchema, SnapshotGapSchema]),
    shared_with: z.array(SnapshotShareSchema).optional(),
  })
  .strict();

export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>;
