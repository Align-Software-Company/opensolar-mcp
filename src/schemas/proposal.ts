import { z } from 'zod';
import { decodeGzipJson } from '../lib/gzip-json.js';

export const ProposalSystemSchema = z.object({
  name: z.string().nullable(),
  annual_kwh: z.number().nullable(),
  monthly_kwh: z.array(z.number()).nullable(),
  payback_year: z.string().nullable(),
  net_present_value: z.string().nullable(),
  irr: z.string().nullable(),
  return_on_investment: z.string().nullable(),
});

export type ProposalSystem = z.infer<typeof ProposalSystemSchema>;

export const ProposalDataOutputSchema = z.object({
  project_id: z.number().int().positive(),
  systems: z.array(ProposalSystemSchema),
});

export type ProposalDataOutput = z.infer<typeof ProposalDataOutputSchema>;

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

function annualKwh(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function monthlyKwh(value: unknown): number[] | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 12) {
    return null;
  }
  const months: number[] = [];
  for (const item of parsed) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      return null;
    }
    months.push(item);
  }
  return months;
}

function display(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function decodedOutput(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (data === null) {
    return null;
  }
  if (typeof data.output === 'string') {
    return asRecord(decodeGzipJson(data.output));
  }
  return asRecord(data.output);
}

export function projectRecord(raw: unknown, projectId: number): Record<string, unknown> | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  for (const org of raw) {
    const projects = asRecord(org)?.projects;
    if (!Array.isArray(projects)) {
      continue;
    }
    for (const project of projects) {
      const record = asRecord(project);
      if (record?.id === projectId) {
        return record;
      }
    }
  }
  return null;
}

export function curateProposalSystems(project: Record<string, unknown>): ProposalSystem[] {
  const proposalData = asRecord(project.proposal_data);
  const systems = proposalData?.systems;
  if (!Array.isArray(systems)) {
    return [];
  }
  const curated: ProposalSystem[] = [];
  for (const system of systems) {
    const record = asRecord(system);
    if (record === null) {
      continue;
    }
    const output = decodedOutput(asRecord(record.data));
    curated.push({
      name: display(record.name),
      annual_kwh: annualKwh(record.systemOutputAnnualkWh ?? output?.systemOutputAnnualkWh),
      monthly_kwh: monthlyKwh(record.output_monthly_json ?? output?.output_monthly_json),
      payback_year: display(record.systemPaybackYear),
      net_present_value: display(record.systemNetPresentValue),
      irr: display(record.systemIrr),
      return_on_investment: display(record.systemReturnOnInvestment),
    });
  }
  return curated;
}
