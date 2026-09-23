import { z } from 'zod';
import { decodeGzipJson } from '../lib/gzip-json.js';

const DesignSystemSchema = z.object({
  system_price_including_tax: z.number().nullable(),
});

export const ProjectDesignOutputSchema = z.discriminatedUnion('design_available', [
  z.object({
    design_available: z.literal(false),
  }),
  z.object({
    design_available: z.literal(true),
    system_count: z.number().int().nonnegative(),
    systems: z.array(DesignSystemSchema),
  }),
]);

export type ProjectDesignOutput = z.infer<typeof ProjectDesignOutputSchema>;

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

function price(system: Record<string, unknown>): number | null {
  const value = system.system_price_including_tax;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function summarizeDesign(
  design: unknown,
): { ok: true; summary: ProjectDesignOutput } | { ok: false; reason: 'invalid' } {
  if (design === undefined || design === null) {
    return { ok: true, summary: { design_available: false } };
  }
  if (typeof design !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  const decoded = asRecord(decodeGzipJson(design));
  if (decoded === null) {
    return { ok: false, reason: 'invalid' };
  }
  const systems: Array<{ system_price_including_tax: number | null }> = [];
  if (Array.isArray(decoded.systems)) {
    for (const system of decoded.systems) {
      const record = asRecord(system);
      if (record === null) {
        continue;
      }
      systems.push({ system_price_including_tax: price(record) });
    }
  }
  return {
    ok: true,
    summary: {
      design_available: true,
      system_count: systems.length,
      systems,
    },
  };
}
