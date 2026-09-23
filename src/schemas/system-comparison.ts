import { z } from 'zod';

const ComparedHardwareSchema = z
  .object({
    manufacturer_name: z.string().optional(),
    code: z.string().optional(),
    quantity: z.number().optional(),
  })
  .strict();

const ComparedSystemSchema = z
  .object({
    id: z.number(),
    uuid: z.string().nullish(),
    name: z.string().nullish(),
    kw_stc: z.number().optional(),
    module_quantity: z.number().optional(),
    output_annual_kwh: z.number().optional(),
    kwh_per_kw_year: z.number().optional(),
    price_including_tax: z.number().optional(),
    price_per_watt: z.number().optional(),
    battery_total_kwh: z.number().optional(),
    modules: z.array(ComparedHardwareSchema).optional(),
    inverters: z.array(ComparedHardwareSchema).optional(),
    batteries: z.array(ComparedHardwareSchema).optional(),
  })
  .strict();

export const CompareProjectSystemsSchema = z
  .object({
    project_id: z.number().int().positive(),
    list_complete: z.boolean(),
    systems: z.array(ComparedSystemSchema),
    hardware_gap: z.string().optional(),
  })
  .strict();

export type CompareProjectSystems = z.infer<typeof CompareProjectSystemsSchema>;
