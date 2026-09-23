import { z } from 'zod';

export const PAYMENT_TYPES = [
  'cash',
  'loan',
  'loan_advanced',
  'ppa',
  'regular_payment',
  'lease',
] as const;

export const PaymentOptionSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    payment_type: z.string().nullish(),
    priority: z.number().nullish(),
    auto_apply_enabled: z.boolean().nullish(),
    is_archived: z.boolean().nullish(),
  })
  .passthrough();

export type PaymentOption = z.infer<typeof PaymentOptionSchema>;

export const PaymentOptionListSchema = z.array(PaymentOptionSchema);

export const PaymentOptionRowSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  payment_type: z.string().nullish(),
  priority: z.number().nullish(),
  auto_apply_enabled: z.boolean().nullish(),
  is_archived: z.boolean().nullish(),
});

export type PaymentOptionRow = z.infer<typeof PaymentOptionRowSchema>;

export function curatePaymentOption(option: PaymentOption): PaymentOptionRow {
  return {
    id: option.id,
    title: option.title,
    payment_type: option.payment_type,
    priority: option.priority,
    auto_apply_enabled: option.auto_apply_enabled,
    is_archived: option.is_archived,
  };
}

export const ListPaymentOptionsOutputSchema = z.object({
  payment_options: z.array(PaymentOptionRowSchema),
  page: z.number().int(),
  limit: z.number().int(),
});
