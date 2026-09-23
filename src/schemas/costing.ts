import { z } from 'zod';

export const CostingSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    priority: z.boolean().nullish(),
  })
  .passthrough();

export type Costing = z.infer<typeof CostingSchema>;

export const CostingListSchema = z.array(CostingSchema);

export const CostingRowSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  priority: z.boolean().nullish(),
});

export type CostingRow = z.infer<typeof CostingRowSchema>;

export function curateCosting(costing: Costing): CostingRow {
  return {
    id: costing.id,
    title: costing.title,
    description: costing.description,
    priority: costing.priority,
  };
}

export const ListCostingsOutputSchema = z.object({
  costings: z.array(CostingRowSchema),
  page: z.number().int(),
  limit: z.number().int(),
});
