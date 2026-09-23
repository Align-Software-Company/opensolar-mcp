import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import { CostingRowSchema, ListCostingsOutputSchema } from '../../src/schemas/costing.js';
import { DeletedRecordSchema } from '../../src/schemas/project.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const curatedCosting = {
  id: 1,
  title: 'Default Project Configuration',
  description: 'Default settings ready for customization.',
  priority: true,
};

describe('list_costings', () => {
  it('sends boolean priority and omits per-unit rates', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('costings', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_costings', arguments: { priority: true } }),
    );
    const payload = ListCostingsOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/costings/?page=1&limit=20&priority=true']);
    expect(calls[0]).not.toContain('auto_apply_enabled');
    expect(calls[0]).not.toContain('pricing_formula');
    expect(payload.costings).toEqual([curatedCosting]);
    expect(serialized).not.toContain('labor_per_watt');
    expect(serialized).not.toContain('98765.43');
    expect(serialized).not.toContain('racking_per_panel');
    expect(serialized).not.toContain('steep_pitch');
    expect(serialized).not.toContain('roof_type_adder');
  });
});

describe('get_costing', () => {
  it('returns one curated costing and sends no query', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('costings', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_costing', arguments: { id: 1 } }),
    );
    const payload = CostingRowSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/costings/1/']);
    expect(payload).toEqual(curatedCosting);
    expect(serialized).not.toContain('labor_per_watt');
    expect(serialized).not.toContain('98765.43');
  });
});

function deleteClient(): { client: OpenSolarClient; writes: string[] } {
  const writes: string[] = [];
  const client = testClient(async () => {
    throw new Error('unexpected OpenSolar read');
  });
  client.delete = async (path) => {
    writes.push(path);
    return null;
  };
  return { client, writes };
}

describe('delete_costing', () => {
  it('deletes one costing and drops the upstream body', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_costing', arguments: { id: 1 } }),
    );
    const payload = DeletedRecordSchema.parse(requireStructuredContent(result));

    expect(writes).toEqual(['orgs/1/costings/1/']);
    expect(payload).toEqual({ id: 1, deleted: true });
  });

  it('rejects an unknown field before HTTP', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'delete_costing',
        arguments: { id: 1, labor_per_watt: 1 },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });
});
