import { z } from 'zod';
import { decodeGzipJson } from '../lib/gzip-json.js';

const designSections = ['summary', 'components', 'geometry', 'energy', 'financials'] as const;

export const DesignSectionSchema = z.enum(designSections);

export type DesignSection = z.infer<typeof DesignSectionSchema>;

const SummarySystemSchema = z
  .object({
    system_price_including_tax: z.number().nullable(),
  })
  .strict();

const FinancialSystemSchema = z
  .object({
    system_price_including_tax: z.number().nullable(),
    margin: z.number().optional(),
    discount: z.number().optional(),
    dealer_fee: z.number().optional(),
    tax: z.number().optional(),
    payback_year: z.number().optional(),
    net_present_value: z.number().optional(),
    internal_rate_of_return: z.number().optional(),
  })
  .strict();

const unavailableDesign = z
  .object({
    design_available: z.literal(false),
  })
  .strict();

const summaryDesign = z
  .object({
    design_available: z.literal(true),
    section: z.literal('summary'),
    system_count: z.number().int().nonnegative(),
    systems: z.array(SummarySystemSchema),
  })
  .strict();

const unmappedDesign = z
  .object({
    design_available: z.literal(true),
    section: z.enum(['components', 'energy']),
    unmapped: z.literal(true),
  })
  .strict();

const geometryDesign = z
  .object({
    design_available: z.literal(true),
    section: z.literal('geometry'),
    autoFacetsGeoJson: z.enum(['present', 'absent']),
  })
  .strict();

const financialDesign = z
  .object({
    design_available: z.literal(true),
    section: z.literal('financials'),
    systems: z.array(FinancialSystemSchema),
  })
  .strict();

export const ProjectDesignOutputSchema = z.union([
  unavailableDesign,
  summaryDesign,
  unmappedDesign,
  geometryDesign,
  financialDesign,
]);

export type ProjectDesignOutput = z.infer<typeof ProjectDesignOutputSchema>;

const financialNumberKeys = [
  'margin',
  'discount',
  'dealer_fee',
  'tax',
  'payback_year',
  'net_present_value',
  'internal_rate_of_return',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function price(system: Record<string, unknown>): number | null {
  return finiteNumber(system.system_price_including_tax) ?? null;
}

function systemRecords(design: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(design.systems)) {
    return [];
  }
  const systems: Record<string, unknown>[] = [];
  for (const system of design.systems) {
    const record = asRecord(system);
    if (record !== null) {
      systems.push(record);
    }
  }
  return systems;
}

function financialSystem(system: Record<string, unknown>): z.infer<typeof FinancialSystemSchema> {
  const row: z.infer<typeof FinancialSystemSchema> = {
    system_price_including_tax: price(system),
  };
  for (const key of financialNumberKeys) {
    const value = finiteNumber(system[key]);
    if (value !== undefined) {
      row[key] = value;
    }
  }
  return row;
}

export function projectDesign(
  design: unknown,
  section: DesignSection,
): { ok: true; design: ProjectDesignOutput } | { ok: false; reason: 'invalid' } {
  if (design === undefined || design === null) {
    return { ok: true, design: { design_available: false } };
  }
  if (typeof design !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  const decoded = asRecord(decodeGzipJson(design));
  if (decoded === null) {
    return { ok: false, reason: 'invalid' };
  }
  if (section === 'components' || section === 'energy') {
    return { ok: true, design: { design_available: true, section, unmapped: true } };
  }
  if (section === 'geometry') {
    const facets = decoded.autoFacetsGeoJson;
    return {
      ok: true,
      design: {
        design_available: true,
        section: 'geometry',
        autoFacetsGeoJson: facets === undefined || facets === null ? 'absent' : 'present',
      },
    };
  }
  const systems = systemRecords(decoded);
  if (section === 'financials') {
    return {
      ok: true,
      design: {
        design_available: true,
        section: 'financials',
        systems: systems.map(financialSystem),
      },
    };
  }
  return {
    ok: true,
    design: {
      design_available: true,
      section: 'summary',
      system_count: systems.length,
      systems: systems.map((system) => ({ system_price_including_tax: price(system) })),
    },
  };
}
