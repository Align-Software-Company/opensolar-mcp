import { z } from 'zod';

export const PRICING_FORMULAS = [
  'Markup Percentage',
  'Price Per Watt',
  'Price Per Watt By Size',
  'Fixed Price',
] as const;

export const PricingSchemeSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    pricing_formula: z.string().nullish(),
    priority: z.number().nullish(),
    auto_apply_enabled: z.boolean().nullish(),
    is_archived: z.boolean().nullish(),
  })
  .passthrough();

export type PricingScheme = z.infer<typeof PricingSchemeSchema>;

export const PricingSchemeListSchema = z.array(PricingSchemeSchema);

export const PricingSchemeRowSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  pricing_formula: z.string().nullish(),
  priority: z.number().nullish(),
  auto_apply_enabled: z.boolean().nullish(),
  is_archived: z.boolean().nullish(),
});

export type PricingSchemeRow = z.infer<typeof PricingSchemeRowSchema>;

export function curatePricingScheme(scheme: PricingScheme): PricingSchemeRow {
  return {
    id: scheme.id,
    title: scheme.title,
    pricing_formula: scheme.pricing_formula,
    priority: scheme.priority,
    auto_apply_enabled: scheme.auto_apply_enabled,
    is_archived: scheme.is_archived,
  };
}

export const ListPricingSchemesOutputSchema = z.object({
  pricing_schemes: z.array(PricingSchemeRowSchema),
  page: z.number().int(),
  limit: z.number().int(),
});
