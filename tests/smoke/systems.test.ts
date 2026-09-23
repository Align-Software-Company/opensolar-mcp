import { describe, expect, it } from 'vitest';
import {
  GetSystemDetailsOutputSchema,
  GetSystemOutputSchema,
  ListProjectSystemsOutputSchema,
} from '../../src/schemas/system.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('systems', () => {
  it('lists project systems with fieldset=list and without hardware arrays', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('systems', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({
        name: 'list_project_systems',
        arguments: { project_id: 1001 },
      }),
    );
    const payload = ListProjectSystemsOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/systems/?fieldset=list&project=1001&page=1&limit=20']);
    expect(payload.systems[0]).toEqual({
      id: 1253,
      uuid: 'E583FD88-EB6C-4311-91A9-AC719041EAA8',
      name: 'Example array',
      kw_stc: 2.76,
      module_quantity: 8,
      battery_total_kwh: 0,
      output_annual_kwh: 5497,
      price_including_tax: 5520,
    });
    expect(serialized).not.toContain('JKM285M-60');
    expect(serialized).not.toContain('modules');
  });

  it('returns hardware codes and quantities on get_system', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('systems', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_system', arguments: { id: 1253 } }),
    );
    const payload = GetSystemOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/systems/1253/?fieldset=list']);
    expect(payload.modules).toEqual([
      { code: 'JKM285M-60', manufacturer_name: 'Example Modules', quantity: 8 },
    ]);
    expect(payload.inverters).toEqual([
      { code: 'INV-1', manufacturer_name: 'Example Inverters', quantity: 1 },
    ]);
    expect(payload.batteries).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain('module_activation_id');
  });

  it('requests default parts with a 120 second timeout and omits custom data', async () => {
    const calls: { path: string; timeoutMs?: number }[] = [];
    const mcp = buildServer({
      client: testClient(async (path, options) => {
        calls.push({ path, timeoutMs: options?.timeoutMs });
        return loadOpenSolarFixture('systems', 'details');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_system_details', arguments: { project_id: 1001 } }),
    );
    const payload = GetSystemDetailsOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual([
      {
        path: 'orgs/1/projects/1001/systems/details/?include_parts=modules%2Cinverters%2Cbatteries%2Cmodule_groups%2Cincentives',
        timeoutMs: 120_000,
      },
    ]);
    expect(payload.systems[0]).toMatchObject({
      id: 8280,
      modules: [{ code: 'LG345N1C-V5', quantity: 18 }],
      module_groups: [{ module_quantity: 18, azimuth: 7, slope: 20, layout: 'portrait' }],
      incentives: [{ title: 'Example incentive', value: 884, paid_to_customer: true }],
    });
    expect(serialized).not.toContain('custom_data');
    expect(serialized).not.toContain('omit-me');
    expect(serialized).not.toContain('adders');
    expect(serialized).not.toContain('other_components');
    expect(serialized).not.toContain('shadingFactor');
  });

  it('does not call OpenSolar when both part filters are set', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('systems', 'details');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({
        name: 'get_system_details',
        arguments: {
          project_id: 1001,
          include_parts: 'modules',
          exclude_parts: 'adders',
        },
      }),
    );

    expect(calls).toEqual([]);
    expect(result.isError).toBe(true);
  });
});
