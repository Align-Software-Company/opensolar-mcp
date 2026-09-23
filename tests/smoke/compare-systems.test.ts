import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('compare_project_systems', () => {
  it('keeps columns each system actually has and does not rank a winner', async () => {
    const paths: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        paths.push(path);
        if (path.startsWith('orgs/1/systems/?')) {
          return [
            {
              id: 1,
              name: 'Priced',
              uuid: 'priced',
              kw_stc: 2,
              module_quantity: 8,
              output_annual_kwh: 4000,
              price_including_tax: 2000,
              battery_total_kwh: 5,
              modules: [{ manufacturer_name: 'Example Modules', code: 'JKM', quantity: 8 }],
              inverters: [],
              batteries: [],
            },
            {
              id: 2,
              name: 'Unpriced',
              uuid: 'unpriced',
              kw_stc: 3,
              module_quantity: 10,
            },
          ];
        }
        if (path.includes('/systems/details/')) {
          return {
            systems: [
              {
                id: 2,
                modules: [{ manufacturer_name: 'Other Modules', code: 'OTH', quantity: 10 }],
                inverters: [],
                batteries: [],
              },
            ],
          };
        }
        throw new Error(`unexpected read ${path}`);
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'compare_project_systems', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      systems: Array<Record<string, unknown>>;
      list_complete: boolean;
    };
    const serialized = JSON.stringify(payload);

    expect(paths[0]).toContain('fieldset=list&project=1001&page=1&limit=100');
    expect(paths[1]).toContain('include_parts=modules,inverters,batteries');
    expect(payload.list_complete).toBe(true);
    expect(payload.systems[0]).toMatchObject({
      id: 1,
      kw_stc: 2,
      output_annual_kwh: 4000,
      kwh_per_kw_year: 2000,
      price_including_tax: 2000,
      price_per_watt: 1,
      battery_total_kwh: 5,
      modules: [{ manufacturer_name: 'Example Modules', code: 'JKM', quantity: 8 }],
    });
    expect(payload.systems[1]).toMatchObject({
      id: 2,
      kw_stc: 3,
      modules: [{ manufacturer_name: 'Other Modules', code: 'OTH', quantity: 10 }],
    });
    expect(payload.systems[1]).not.toHaveProperty('price_including_tax');
    expect(payload.systems[1]).not.toHaveProperty('price_per_watt');
    expect(payload.systems[1]).not.toHaveProperty('output_annual_kwh');
    expect(payload.systems[1]).not.toHaveProperty('kwh_per_kw_year');
    expect(payload.systems[1]).not.toHaveProperty('battery_total_kwh');
    expect(serialized).not.toContain('winner');
    expect(serialized).not.toContain('rank');
  });

  it('requests one details call for a missing group and does not replace hardware the list already sent', async () => {
    const paths: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        paths.push(path);
        if (path.startsWith('orgs/1/systems/?')) {
          return [
            {
              id: 1,
              modules: [{ manufacturer_name: 'List Modules', code: 'LIST', quantity: 8 }],
            },
          ];
        }
        if (path.includes('/systems/details/')) {
          return {
            systems: [
              {
                id: 1,
                modules: [{ manufacturer_name: 'Details Modules', code: 'DET', quantity: 1 }],
                inverters: [{ manufacturer_name: 'Details Inverters', code: 'INV', quantity: 1 }],
                batteries: [{ manufacturer_name: 'Details Batteries', code: 'BAT', quantity: 1 }],
              },
            ],
          };
        }
        throw new Error(`unexpected read ${path}`);
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'compare_project_systems', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      systems: Array<{
        modules?: Array<{ manufacturer_name?: string }>;
        inverters?: Array<{ manufacturer_name?: string }>;
        batteries?: Array<{ manufacturer_name?: string }>;
      }>;
    };
    const detailsCalls = paths.filter((path) => path.includes('/systems/details/'));

    expect(detailsCalls).toHaveLength(1);
    expect(payload.systems[0]?.modules).toEqual([
      { manufacturer_name: 'List Modules', code: 'LIST', quantity: 8 },
    ]);
    expect(payload.systems[0]?.inverters).toEqual([
      { manufacturer_name: 'Details Inverters', code: 'INV', quantity: 1 },
    ]);
    expect(payload.systems[0]?.batteries).toEqual([
      { manufacturer_name: 'Details Batteries', code: 'BAT', quantity: 1 },
    ]);
  });

  it('does not call system details when every hardware group is present, including empty arrays', async () => {
    const paths: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        paths.push(path);
        return [
          {
            id: 1,
            kw_stc: 4,
            price_including_tax: 8000,
            modules: [{ manufacturer_name: 'Example Modules', quantity: 12 }],
            inverters: [],
            batteries: [],
          },
        ];
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'compare_project_systems', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      systems: Array<{ price_per_watt?: number; modules?: unknown[] }>;
    };

    expect(paths).toHaveLength(1);
    expect(paths[0]).not.toContain('details');
    expect(payload.systems[0]?.price_per_watt).toBe(2);
    expect(payload.systems[0]?.modules).toEqual([
      { manufacturer_name: 'Example Modules', quantity: 12 },
    ]);
  });

  it('keeps list columns when system details fails', async () => {
    const mcp = buildServer({
      client: testClient(async (path) => {
        if (path.includes('/systems/details/')) {
          throw new OpenSolarApiError('nope', 404, '');
        }
        return [{ id: 9, kw_stc: 1, output_annual_kwh: 1500, name: 'Bare' }];
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'compare_project_systems', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      hardware_gap?: string;
      systems: Array<Record<string, unknown>>;
    };

    expect(payload.hardware_gap).toBe('The record was not found');
    expect(payload.systems[0]).toMatchObject({
      id: 9,
      kw_stc: 1,
      output_annual_kwh: 1500,
      kwh_per_kw_year: 1500,
    });
    expect(payload.systems[0]).not.toHaveProperty('modules');
    expect(payload.systems[0]).not.toHaveProperty('price_including_tax');
  });
});
