import { z } from 'zod';

const HardwareSchema = z
  .object({
    code: z.string().nullish(),
    manufacturer_name: z.string().nullish(),
    quantity: z.number().nullish(),
  })
  .passthrough();

type Hardware = z.infer<typeof HardwareSchema>;

const HardwareOutputSchema = z.object({
  code: z.string().nullish(),
  manufacturer_name: z.string().nullish(),
  quantity: z.number().nullish(),
});

type CuratedHardware = z.infer<typeof HardwareOutputSchema>;

const ModuleGroupSchema = z
  .object({
    module_quantity: z.number().nullish(),
    azimuth: z.number().nullish(),
    slope: z.number().nullish(),
    layout: z.string().nullish(),
  })
  .passthrough();

const IncentiveSchema = z
  .object({
    title: z.string().nullish(),
    value: z.number().nullish(),
    paid_to_customer: z.boolean().nullish(),
  })
  .passthrough();

export const SystemSchema = z
  .object({
    id: z.number(),
    uuid: z.string().nullish(),
    name: z.string().nullish(),
    kw_stc: z.number().nullish(),
    module_quantity: z.number().nullish(),
    battery_total_kwh: z.number().nullish(),
    output_annual_kwh: z.number().nullish(),
    price_including_tax: z.number().nullish(),
    modules: z.array(HardwareSchema).nullish(),
    inverters: z.array(HardwareSchema).nullish(),
    batteries: z.array(HardwareSchema).nullish(),
  })
  .passthrough();

export type System = z.infer<typeof SystemSchema>;

export const SystemListSchema = z.array(SystemSchema);

export const SystemListRowOutputSchema = z.object({
  id: z.number(),
  uuid: z.string().nullish(),
  name: z.string().nullish(),
  kw_stc: z.number().nullish(),
  module_quantity: z.number().nullish(),
  battery_total_kwh: z.number().nullish(),
  output_annual_kwh: z.number().nullish(),
  price_including_tax: z.number().nullish(),
});

export type SystemListRow = z.infer<typeof SystemListRowOutputSchema>;

export const ListProjectSystemsOutputSchema = z.object({
  systems: z.array(SystemListRowOutputSchema),
  page: z.number().int(),
  limit: z.number().int(),
});

export const GetSystemOutputSchema = SystemListRowOutputSchema.extend({
  modules: z.array(HardwareOutputSchema).optional(),
  inverters: z.array(HardwareOutputSchema).optional(),
  batteries: z.array(HardwareOutputSchema).optional(),
});

export type SystemDetail = z.infer<typeof GetSystemOutputSchema>;

function curateHardware(items: Hardware[] | null | undefined): CuratedHardware[] | undefined {
  if (items === null || items === undefined) {
    return undefined;
  }
  return items.map((item) => ({
    code: item.code,
    manufacturer_name: item.manufacturer_name,
    quantity: item.quantity,
  }));
}

export function curateSystemListRow(system: System): SystemListRow {
  return {
    id: system.id,
    uuid: system.uuid,
    name: system.name,
    kw_stc: system.kw_stc,
    module_quantity: system.module_quantity,
    battery_total_kwh: system.battery_total_kwh,
    output_annual_kwh: system.output_annual_kwh,
    price_including_tax: system.price_including_tax,
  };
}

export function curateSystem(system: System): SystemDetail {
  const curated: SystemDetail = curateSystemListRow(system);
  const modules = curateHardware(system.modules);
  const inverters = curateHardware(system.inverters);
  const batteries = curateHardware(system.batteries);
  if (modules !== undefined) {
    curated.modules = modules;
  }
  if (inverters !== undefined) {
    curated.inverters = inverters;
  }
  if (batteries !== undefined) {
    curated.batteries = batteries;
  }
  return curated;
}

const SystemDetailsSystemSchema = z
  .object({
    id: z.number(),
    uuid: z.string().nullish(),
    name: z.string().nullish(),
    kw_stc: z.number().nullish(),
    total_module_quantity: z.number().nullish(),
    modules: z.array(HardwareSchema).nullish(),
    inverters: z.array(HardwareSchema).nullish(),
    batteries: z.array(HardwareSchema).nullish(),
    module_groups: z.array(ModuleGroupSchema).nullish(),
    incentives: z.array(IncentiveSchema).nullish(),
  })
  .passthrough();

export const SystemDetailsResponseSchema = z.object({
  systems: z.array(SystemDetailsSystemSchema),
});

export type SystemDetailsResponse = z.infer<typeof SystemDetailsResponseSchema>;

const ModuleGroupOutputSchema = z.object({
  module_quantity: z.number().nullish(),
  azimuth: z.number().nullish(),
  slope: z.number().nullish(),
  layout: z.string().nullish(),
});

const IncentiveOutputSchema = z.object({
  title: z.string().nullish(),
  value: z.number().nullish(),
  paid_to_customer: z.boolean().nullish(),
});

export const SystemDetailsRowOutputSchema = z.object({
  id: z.number(),
  uuid: z.string().nullish(),
  name: z.string().nullish(),
  kw_stc: z.number().nullish(),
  total_module_quantity: z.number().nullish(),
  modules: z.array(HardwareOutputSchema).optional(),
  inverters: z.array(HardwareOutputSchema).optional(),
  batteries: z.array(HardwareOutputSchema).optional(),
  module_groups: z.array(ModuleGroupOutputSchema).optional(),
  incentives: z.array(IncentiveOutputSchema).optional(),
});

export type SystemDetailsRow = z.infer<typeof SystemDetailsRowOutputSchema>;

export const GetSystemDetailsOutputSchema = z.object({
  systems: z.array(SystemDetailsRowOutputSchema),
});

export function curateSystemDetails(response: SystemDetailsResponse): {
  systems: SystemDetailsRow[];
} {
  return {
    systems: response.systems.map((system) => {
      const row: SystemDetailsRow = {
        id: system.id,
        uuid: system.uuid,
        name: system.name,
        kw_stc: system.kw_stc,
        total_module_quantity: system.total_module_quantity,
      };
      const modules = curateHardware(system.modules);
      const inverters = curateHardware(system.inverters);
      const batteries = curateHardware(system.batteries);
      if (modules !== undefined) {
        row.modules = modules;
      }
      if (inverters !== undefined) {
        row.inverters = inverters;
      }
      if (batteries !== undefined) {
        row.batteries = batteries;
      }
      if (system.module_groups != null) {
        row.module_groups = system.module_groups.map((group) => ({
          module_quantity: group.module_quantity,
          azimuth: group.azimuth,
          slope: group.slope,
          layout: group.layout,
        }));
      }
      if (system.incentives != null) {
        row.incentives = system.incentives.map((incentive) => ({
          title: incentive.title,
          value: incentive.value,
          paid_to_customer: incentive.paid_to_customer,
        }));
      }
      return row;
    }),
  };
}

export const SystemImageOutputSchema = z.object({
  id: z.number().int().positive().nullable(),
  content_type: z.string().nullable(),
});
