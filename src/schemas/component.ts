import { z } from 'zod';

export const ActivationSchema = z
  .object({
    id: z.number(),
    code: z.string().nullish(),
    manufacturer_name: z.string().nullish(),
    is_default: z.boolean().nullish(),
    is_archived: z.boolean().nullish(),
  })
  .passthrough();

export type Activation = z.infer<typeof ActivationSchema>;

export const ActivationListSchema = z.array(ActivationSchema);

export const ActivationRowSchema = z.object({
  id: z.number(),
  code: z.string().nullish(),
  manufacturer_name: z.string().nullish(),
  is_default: z.boolean().nullish(),
  is_archived: z.boolean().nullish(),
});

export type ActivationRow = z.infer<typeof ActivationRowSchema>;

export function curateActivation(activation: Activation): ActivationRow {
  return {
    id: activation.id,
    code: activation.code,
    manufacturer_name: activation.manufacturer_name,
    is_default: activation.is_default,
    is_archived: activation.is_archived,
  };
}

export function activationListOutputSchema(
  key: 'modules' | 'inverters' | 'batteries' | 'other_components',
) {
  return z.object({
    [key]: z.array(ActivationRowSchema),
    page: z.number().int(),
    limit: z.number().int(),
  });
}
