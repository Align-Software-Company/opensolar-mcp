import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import { ActivationRowSchema, activationListOutputSchema } from '../../src/schemas/component.js';
import { DeletedRecordSchema } from '../../src/schemas/project.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const lists = [
  {
    name: 'list_modules',
    segment: 'component_module_activations',
    outputKey: 'modules',
  },
  {
    name: 'list_inverters',
    segment: 'component_inverter_activations',
    outputKey: 'inverters',
  },
  {
    name: 'list_batteries',
    segment: 'component_battery_activations',
    outputKey: 'batteries',
  },
  {
    name: 'list_other_components',
    segment: 'component_other_activations',
    outputKey: 'other_components',
  },
] as const;

const details = [
  { name: 'get_module', segment: 'component_module_activations' },
  { name: 'get_inverter', segment: 'component_inverter_activations' },
  { name: 'get_battery', segment: 'component_battery_activations' },
  { name: 'get_other_component', segment: 'component_other_activations' },
] as const;

describe('component lists', () => {
  it.each(lists)('$name requests one page and omits the spec blob', async (entry) => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('components', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: entry.name, arguments: {} }),
    );
    const payload = activationListOutputSchema(entry.outputKey).parse(
      requireStructuredContent(result),
    );
    const serialized = JSON.stringify(payload);
    const rows = payload[entry.outputKey];

    expect(calls).toEqual([`orgs/1/${entry.segment}/?page=1&limit=20`]);
    expect(rows).toEqual([
      {
        id: 1,
        code: 'LG330N1C-A5',
        manufacturer_name: 'Example Modules',
        is_default: false,
        is_archived: false,
      },
    ]);
    expect(serialized).not.toContain('SPEC-BLOB');
    expect(serialized).not.toContain('"data"');
  });
});

describe('component details', () => {
  it.each(details)('$name returns one curated activation and omits data', async (entry) => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('components', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: entry.name, arguments: { id: 42 } }),
    );
    const payload = ActivationRowSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual([`orgs/1/${entry.segment}/42/`]);
    expect(payload).toEqual({
      id: 42,
      code: 'MOD-100',
      manufacturer_name: 'Example Solar',
      is_default: true,
      is_archived: false,
    });
    expect(serialized).not.toContain('SPEC-BLOB');
    expect(serialized).not.toContain('"data"');
  });
});

const deletes = [
  { name: 'delete_module_activation', segment: 'component_module_activations' },
  { name: 'delete_inverter_activation', segment: 'component_inverter_activations' },
  { name: 'delete_battery_activation', segment: 'component_battery_activations' },
  { name: 'delete_other_component_activation', segment: 'component_other_activations' },
] as const;

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

describe('component deletes', () => {
  it.each(deletes)('$name deletes one activation and drops the upstream body', async (entry) => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: entry.name, arguments: { id: 9 } }),
    );
    const payload = DeletedRecordSchema.parse(requireStructuredContent(result));

    expect(writes).toEqual([`orgs/1/${entry.segment}/9/`]);
    expect(payload).toEqual({ id: 9, deleted: true });
  });

  it('rejects an unknown field before HTTP', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'delete_module_activation',
        arguments: { id: 9, code: 'LG330N1C-A5' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });
});
