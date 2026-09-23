import { describe, expect, it } from 'vitest';
import { CuratedRoleSchema, ListRolesOutputSchema } from '../../src/schemas/role.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('list_roles', () => {
  it('lists curated roles and omits api_key_chat', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('roles', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_roles', arguments: {} }),
    );
    const payload = ListRolesOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/roles/']);
    expect(payload.roles).toEqual([
      {
        id: 99,
        display: 'Pat Example',
        email: 'pat@example.test',
        phone: '2025550100',
        job_title: 'Sales',
        is_admin: true,
      },
    ]);
    expect(serialized).not.toContain('api_key_chat');
    expect(serialized).not.toContain('chat-key-example');
  });
});

describe('get_role', () => {
  it('returns one curated role and omits api_key_chat', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('roles', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_role', arguments: { id: 9 } }),
    );
    const payload = CuratedRoleSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/roles/9/']);
    expect(payload).toEqual({
      id: 9,
      display: 'Alex Example',
      email: 'alex@example.com',
      phone: '+1-555-0100',
      job_title: 'Designer',
      is_admin: false,
    });
    expect(serialized).not.toContain('api_key_chat');
    expect(serialized).not.toContain('chat-secret-not-for-output');
  });

  it('sends fieldset=list and does not send ordering', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('roles', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_role', arguments: { id: 9, fieldset: 'list' } }),
    );

    expect(calls).toEqual(['orgs/1/roles/9/?fieldset=list']);
    expect(calls[0]).not.toContain('ordering');
  });
});
