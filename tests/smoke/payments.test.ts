import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import {
  ListPaymentOptionsOutputSchema,
  PaymentOptionRowSchema,
} from '../../src/schemas/payment.js';
import { DeletedRecordSchema } from '../../src/schemas/project.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('list_payment_options', () => {
  it('omits configuration_json and sends only the filters that were set', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('payments', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({
        name: 'list_payment_options',
        arguments: { payment_type: 'cash' },
      }),
    );
    const payload = ListPaymentOptionsOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/payment_options/?page=1&limit=20&payment_type=cash']);
    expect(calls[0]).not.toContain('auto_apply_enabled');
    expect(calls[0]).not.toContain('priority');
    expect(payload.payment_options).toEqual([
      {
        id: 242,
        title: 'Example loan',
        payment_type: 'loan_advanced',
        priority: 1,
        auto_apply_enabled: false,
        is_archived: false,
      },
    ]);
    expect(serialized).not.toContain('configuration_json');
    expect(serialized).not.toContain('collect_signature');
  });
});

describe('get_payment_option', () => {
  it('returns one curated option and omits configuration_json', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('payments', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_payment_option', arguments: { id: 7 } }),
    );
    const payload = PaymentOptionRowSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/payment_options/7/']);
    expect(payload).toEqual({
      id: 7,
      title: 'Cash',
      payment_type: 'cash',
      priority: 1,
      auto_apply_enabled: true,
      is_archived: false,
    });
    expect(serialized).not.toContain('configuration_json');
    expect(serialized).not.toContain('collect_signature');
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

describe('delete_payment_option', () => {
  it('deletes one option and drops the upstream body', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_payment_option', arguments: { id: 242 } }),
    );
    const payload = DeletedRecordSchema.parse(requireStructuredContent(result));

    expect(writes).toEqual(['orgs/1/payment_options/242/']);
    expect(payload).toEqual({ id: 242, deleted: true });
  });

  it('rejects an unknown field before HTTP', async () => {
    const { client, writes } = deleteClient();
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'delete_payment_option',
        arguments: { id: 242, title: '1 year Delay' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });
});
