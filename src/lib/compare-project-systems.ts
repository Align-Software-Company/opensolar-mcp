import { messageForOpenSolarError } from '../client/errors.js';
import { OpenSolarApiError, type OpenSolarClient } from '../client/index.js';
import { type System, SystemDetailsResponseSchema, SystemListSchema } from '../schemas/system.js';
import type { CompareProjectSystems } from '../schemas/system-comparison.js';

const SYSTEMS_PAGE_SIZE = 100;
const DETAILS_TIMEOUT_MS = 120_000;
const DETAILS_PARTS = 'modules,inverters,batteries';

type HardwareList = NonNullable<System['modules']>;

type NamedHardware = {
  manufacturer_name?: string;
  code?: string;
  quantity?: number;
};

export async function loadSystemComparison(
  client: OpenSolarClient,
  orgId: number,
  projectId: number,
): Promise<CompareProjectSystems> {
  const listPath = `orgs/${orgId}/systems/?fieldset=list&project=${projectId}&page=1&limit=${SYSTEMS_PAGE_SIZE}`;
  const listed = SystemListSchema.parse(await client.get(listPath));
  const needsDetails = listed.some((system) => !hasAllHardwareGroups(system));
  const details = needsDetails ? await hardwareById(client, orgId, projectId) : undefined;

  const comparison: CompareProjectSystems = {
    project_id: projectId,
    list_complete: listed.length < SYSTEMS_PAGE_SIZE,
    systems: listed.map((system) => compareSystem(system, details?.hardware.get(system.id))),
  };
  if (details?.gap !== undefined) {
    comparison.hardware_gap = details.gap;
  }
  return comparison;
}

function compareSystem(
  system: System,
  fallback: HardwareGroups | undefined,
): CompareProjectSystems['systems'][number] {
  const row: CompareProjectSystems['systems'][number] = {
    id: system.id,
    uuid: system.uuid,
    name: system.name,
  };
  assignNumber(row, 'kw_stc', system.kw_stc);
  assignNumber(row, 'module_quantity', system.module_quantity);
  assignNumber(row, 'output_annual_kwh', system.output_annual_kwh);
  assignNumber(row, 'price_including_tax', system.price_including_tax);
  assignNumber(row, 'battery_total_kwh', system.battery_total_kwh);

  const kw = finiteNumber(system.kw_stc);
  const annual = finiteNumber(system.output_annual_kwh);
  const price = finiteNumber(system.price_including_tax);
  if (kw !== undefined && kw > 0 && annual !== undefined) {
    row.kwh_per_kw_year = annual / kw;
  }
  if (kw !== undefined && kw > 0 && price !== undefined) {
    row.price_per_watt = price / (kw * 1000);
  }

  const modules = namedHardware(system.modules ?? fallback?.modules);
  const inverters = namedHardware(system.inverters ?? fallback?.inverters);
  const batteries = namedHardware(system.batteries ?? fallback?.batteries);
  if (modules !== undefined) {
    row.modules = modules;
  }
  if (inverters !== undefined) {
    row.inverters = inverters;
  }
  if (batteries !== undefined) {
    row.batteries = batteries;
  }
  return row;
}

type HardwareGroups = {
  modules?: HardwareList | null;
  inverters?: HardwareList | null;
  batteries?: HardwareList | null;
};

async function hardwareById(
  client: OpenSolarClient,
  orgId: number,
  projectId: number,
): Promise<{ hardware: Map<number, HardwareGroups>; gap?: string }> {
  const path = `orgs/${orgId}/projects/${projectId}/systems/details/?include_parts=${DETAILS_PARTS}`;
  try {
    const raw = await client.get(path, { timeoutMs: DETAILS_TIMEOUT_MS });
    const parsed = SystemDetailsResponseSchema.parse(raw);
    const hardware = new Map<number, HardwareGroups>();
    for (const system of parsed.systems) {
      hardware.set(system.id, {
        modules: system.modules,
        inverters: system.inverters,
        batteries: system.batteries,
      });
    }
    return { hardware };
  } catch (error) {
    if (error instanceof OpenSolarApiError) {
      return { hardware: new Map(), gap: messageForOpenSolarError(error) };
    }
    throw error;
  }
}

function hasAllHardwareGroups(system: System): boolean {
  return system.modules != null && system.inverters != null && system.batteries != null;
}

function namedHardware(items: HardwareList | null | undefined): NamedHardware[] | undefined {
  if (items == null) {
    return undefined;
  }
  const named: NamedHardware[] = [];
  for (const item of items) {
    const row: NamedHardware = {};
    if (typeof item.manufacturer_name === 'string' && item.manufacturer_name !== '') {
      row.manufacturer_name = item.manufacturer_name;
    }
    if (typeof item.code === 'string' && item.code !== '') {
      row.code = item.code;
    }
    const quantity = finiteNumber(item.quantity);
    if (quantity !== undefined) {
      row.quantity = quantity;
    }
    if (
      row.manufacturer_name !== undefined ||
      row.code !== undefined ||
      row.quantity !== undefined
    ) {
      named.push(row);
    }
  }
  return named;
}

function assignNumber(
  row: CompareProjectSystems['systems'][number],
  key:
    | 'kw_stc'
    | 'module_quantity'
    | 'output_annual_kwh'
    | 'price_including_tax'
    | 'battery_total_kwh',
  value: number | null | undefined,
): void {
  const number = finiteNumber(value);
  if (number !== undefined) {
    row[key] = number;
  }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
