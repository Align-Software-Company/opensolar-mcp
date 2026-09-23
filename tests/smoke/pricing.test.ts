import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import {
  ListPricingSchemesOutputSchema,
  PricingSchemeRowSchema,
} from '../../src/schemas/pricing.js';
import { DeletedRecordSchema } from '../../src/schemas/project.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const curatedScheme = {
  id: 68,
  title: 'per equipment',
  pricing_formula: 'Price Per Module/Inverter/Battery',
  priority: 1,
  auto_apply_enabled: true,
  is_archived: false,
};

describe('list_pricing_schemes', () => {
  it('sends only pricing_formula when that filter is set and omits configuration_json', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('pricing', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({
        name: 'list_pricing_schemes',
        arguments: { pricing_formula: 'Price Per Watt' },
      }),
    );
    const payload = ListPricingSchemesOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual([
      'orgs/1/pricing_schemes/?page=1&limit=20&pricing_formula=Price+Per+Watt',
    ]);
    expect(calls[0]).not.toContain('auto_apply_enabled');
    expect(calls[0]).not.toContain('priority');
    expect(payload.pricing_schemes).toEqual([curatedScheme]);
    expect(serialized).not.toContain('configuration_json');
    expect(serialized).not.toContain('FORMULA-BLOB');
    expect(serialized).not.toContain('STATE-BLOB');
    expect(serialized).not.toContain('ZIP-BLOB');
  });
});

describe('get_pricing_scheme', () => {
  it('returns one curated scheme and sends no query', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('pricing', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_pricing_scheme', arguments: { id: 68 } }),
    );
    const payload = PricingSchemeRowSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/pricing_schemes/68/']);
    expect(payload).toEqual(curatedScheme);
    expect(serialized).not.toContain('configuration_json');
    expect(serialized).not.toContain('FORMULA-BLOB');
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

describe('delete_pricing_scheme', () => {
  it('deletes one scheme and drops the upstream body', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_pricing_scheme', arguments: { id: 68 } }),
    );
    const payload = DeletedRecordSchema.parse(requireStructuredContent(result));

    expect(writes).toEqual(['orgs/1/pricing_schemes/68/']);
    expect(payload).toEqual({ id: 68, deleted: true });
  });

  it('rejects an unknown field before HTTP', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'delete_pricing_scheme',
        arguments: { id: 68, title: 'per equipment' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });
});
