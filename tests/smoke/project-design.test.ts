import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { ProjectDesignOutputSchema } from '../../src/schemas/design.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

function gzipJson(value: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(value))).toString('base64');
}

describe('get_project_design', () => {
  it('returns design_available false when design is null', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return { id: 42, design: null, address: '1 Test St' };
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_design', arguments: { project_id: 42 } }),
    );
    const payload = ProjectDesignOutputSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/projects/42/']);
    expect(payload).toEqual({ design_available: false });
  });

  it('summarizes system count and price and drops the rest of the design', async () => {
    const design = gzipJson({
      autoFacetsGeoJson: { type: 'Polygon', coordinates: [[[1, 2]]] },
      systems: [
        {
          system_price_including_tax: 12000,
          line_items: [{ label: 'panels' }],
          costs: { modules: 4000 },
          output: { annual: 8547, hourly: [1, 2, 3] },
          modules: [{ code: 'LG345', quantity: 18 }],
          inverters: [{ code: 'FRONIUS' }],
          batteries: [{ code: 'PWR' }],
        },
        {
          name: 'unsized',
        },
      ],
    });
    const client = testClient(async () => ({ id: 42, design }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_design', arguments: { project_id: 42 } }),
    );
    const payload = ProjectDesignOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(result);

    expect(payload).toEqual({
      design_available: true,
      section: 'summary',
      system_count: 2,
      systems: [{ system_price_including_tax: 12000 }, { system_price_including_tax: null }],
    });
    expect(serialized).not.toContain(design);
    expect(serialized).not.toContain('H4sI');
    expect(serialized).not.toContain('autoFacetsGeoJson');
    expect(serialized).not.toContain('LG345');
    expect(serialized).not.toContain('hourly');
    expect(serialized).not.toContain('line_items');
  });

  it('does not echo a design string that cannot be decoded', async () => {
    const blob = 'H4sI-NOT-A-REAL-GZIP';
    const client = testClient(async () => ({ id: 42, design: blob }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_design', arguments: { project_id: 42 } }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Project design could not be decoded.' },
    ]);
    expect(JSON.stringify(result)).not.toContain(blob);
  });

  it('returns unmapped for components and does not invent module codes', async () => {
    const design = gzipJson({
      systems: [{ modules: [{ code: 'LG345', quantity: 18 }], output: { annual: 8547 } }],
    });
    const client = testClient(async () => ({ id: 42, design }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_project_design',
        arguments: { project_id: 42, section: 'components' },
      }),
    );
    const payload = ProjectDesignOutputSchema.parse(requireStructuredContent(result));

    expect(payload).toEqual({ design_available: true, section: 'components', unmapped: true });
    expect(JSON.stringify(result)).not.toContain('LG345');
    expect(JSON.stringify(result)).not.toContain('8547');
  });

  it('reports geometry presence without coordinates', async () => {
    const design = gzipJson({
      autoFacetsGeoJson: { type: 'Polygon', coordinates: [[[1, 2]]] },
    });
    const client = testClient(async () => ({ id: 42, design }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_project_design',
        arguments: { project_id: 42, section: 'geometry' },
      }),
    );
    const payload = ProjectDesignOutputSchema.parse(requireStructuredContent(result));

    expect(payload).toEqual({
      design_available: true,
      section: 'geometry',
      autoFacetsGeoJson: 'present',
    });
    expect(JSON.stringify(result)).not.toContain('coordinates');
    expect(JSON.stringify(result)).not.toContain('Polygon');
  });

  it('keeps numeric financial keys and drops pricing objects', async () => {
    const design = gzipJson({
      systems: [
        {
          system_price_including_tax: 12000,
          margin: 0.2,
          line_items: [{ label: 'panels' }],
          costs: { modules: 4000 },
          cash_flows: [1, 2, 3],
        },
      ],
    });
    const client = testClient(async () => ({ id: 42, design }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_project_design',
        arguments: { project_id: 42, section: 'financials' },
      }),
    );
    const payload = ProjectDesignOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(result);

    expect(payload).toEqual({
      design_available: true,
      section: 'financials',
      systems: [{ system_price_including_tax: 12000, margin: 0.2 }],
    });
    expect(serialized).not.toContain('line_items');
    expect(serialized).not.toContain('cash_flows');
    expect(serialized).not.toContain('panels');
  });

  it('keeps design_available false for a null design on any section', async () => {
    const client = testClient(async () => ({ id: 42, design: null }));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'get_project_design',
        arguments: { project_id: 42, section: 'energy' },
      }),
    );

    expect(ProjectDesignOutputSchema.parse(requireStructuredContent(result))).toEqual({
      design_available: false,
    });
  });

  it('maps HTTP 402 to the Raw Data message', async () => {
    const client = testClient(async () => {
      throw new OpenSolarApiError('payment', 402, '{"detail":"BODY-SHOULD-NOT-LEAK"}');
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_design', arguments: { project_id: 42 } }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'This call needs Raw Data API Access' }]);
    expect(JSON.stringify(result)).not.toContain('BODY-SHOULD-NOT-LEAK');
  });
});
