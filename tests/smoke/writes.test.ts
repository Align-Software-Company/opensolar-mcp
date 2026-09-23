import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

type WriteCall = {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

function recordingClient(response: unknown): { client: OpenSolarClient; writes: WriteCall[] } {
  const writes: WriteCall[] = [];
  const client = testClient(async () => {
    throw new Error('unexpected OpenSolar read');
  });
  client.post = async (path, body) => {
    writes.push({ method: 'POST', path, body });
    return response;
  };
  client.patch = async (path, body) => {
    writes.push({ method: 'PATCH', path, body });
    return response;
  };
  client.put = async (path, body) => {
    writes.push({ method: 'PUT', path, body });
    return response;
  };
  client.delete = async (path) => {
    writes.push({ method: 'DELETE', path });
    return response;
  };
  return { client, writes };
}

const createdProject = {
  id: 1001,
  address: '12 Example Street',
  url: 'https://api.opensolar.com/api/orgs/1/projects/1001/',
};

describe('project and contact writes', () => {
  it('posts a create_contact allowlist and returns the curated contact', async () => {
    const contacts = loadOpenSolarFixture('contacts', 'list');
    const created = Array.isArray(contacts) ? contacts[0] : undefined;
    const { client, writes } = recordingClient(created);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_contact',
        arguments: { first_name: 'Pat', email: 'pat@example.test' },
      }),
    );
    const payload = requireStructuredContent(result);

    expect(writes).toEqual([
      {
        method: 'POST',
        path: 'orgs/1/contacts/',
        body: { first_name: 'Pat', email: 'pat@example.test' },
      },
    ]);
    expect(payload).toMatchObject({
      id: 3001,
      email: 'pat@example.test',
      is_synthetic_email: false,
    });
  });

  it('rejects an unknown create_contact field before HTTP', async () => {
    const { client, writes } = recordingClient({});
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_contact',
        arguments: { first_name: 'Pat', gender: 'x' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('posts create_project with roof and role URLs and drops url from the result', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_project',
        arguments: {
          address: '12 Example Street',
          is_residential: true,
          number_of_phases: 1,
          roof_type: 6,
          assigned_role: 4,
          contacts_new: [{ first_name: 'Pat', email: 'pat@example.test' }],
        },
      }),
    );
    const payload = requireStructuredContent(result);
    const body = writes[0]?.body;

    expect(writes).toEqual([
      {
        method: 'POST',
        path: 'orgs/1/projects/',
        body: {
          address: '12 Example Street',
          is_residential: true,
          number_of_phases: 1,
          roof_type: 'https://api.opensolar.com/api/roof_types/6/',
          assigned_role: 'https://api.opensolar.com/api/orgs/1/roles/4/',
          contacts_new: [{ first_name: 'Pat', email: 'pat@example.test' }],
        },
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('orgs/1/roof_types');
    expect(JSON.stringify(body)).not.toContain('date_of_birth');
    expect(payload).toEqual({ id: 1001, address: '12 Example Street' });
    expect(JSON.stringify(payload)).not.toContain('url');
  });

  it('rejects an unknown create_project field before HTTP', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_project',
        arguments: { address: '12 Example Street', design: {} },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('patches update_project and does not send contacts_new', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project',
        arguments: { id: 1001, notes: 'Updated', roof_type: 6, assigned_role: 4 },
      }),
    );

    expect(writes).toEqual([
      {
        method: 'PATCH',
        path: 'orgs/1/projects/1001/',
        body: {
          notes: 'Updated',
          roof_type: 'https://api.opensolar.com/api/roof_types/6/',
          assigned_role: 'https://api.opensolar.com/api/orgs/1/roles/4/',
        },
      },
    ]);
    expect(requireStructuredContent(result)).toEqual({
      id: 1001,
      address: '12 Example Street',
    });
  });

  it('does not patch update_project when only id is sent', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'update_project', arguments: { id: 1001 } }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('rejects stage on update_project before HTTP', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project',
        arguments: { id: 1001, stage: 2 },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('patches update_project_stage with workflow ids and drops the project body', async () => {
    const { client, writes } = recordingClient({
      id: 1001,
      address: '12 Example Street',
      url: 'https://api.opensolar.com/api/orgs/1/projects/1001/',
      stage: 2,
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project_stage',
        arguments: { project_id: 1001, workflow_id: 84617, active_stage_id: 433194 },
      }),
    );
    const body = writes[0]?.body;

    expect(writes).toEqual([
      {
        method: 'PATCH',
        path: 'orgs/1/projects/1001/',
        body: {
          workflow: { active_stage_id: 433194, workflow_id: 84617 },
          active_stage_id: 433194,
        },
      },
    ]);
    expect(body).not.toHaveProperty('stage');
    expect(requireStructuredContent(result)).toEqual({
      project_id: 1001,
      workflow_id: 84617,
      active_stage_id: 433194,
    });
  });

  it('rejects a stage name and the deprecated stage field before HTTP', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const { named, deprecated } = await withMcpClient(mcp, async (session) => ({
      named: await session.callTool({
        name: 'update_project_stage',
        arguments: { project_id: 1001, workflow_id: 84617, active_stage_id: 'Designing' },
      }),
      deprecated: await session.callTool({
        name: 'update_project_stage',
        arguments: { project_id: 1001, workflow_id: 84617, active_stage_id: 433194, stage: 2 },
      }),
    }));

    expect(named.isError).toBe(true);
    expect(deprecated.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('puts update_contact with the create allowlist and returns the curated contact', async () => {
    const contacts = loadOpenSolarFixture('contacts', 'list');
    const updated = Array.isArray(contacts) ? contacts[0] : undefined;
    const { client, writes } = recordingClient(updated);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_contact',
        arguments: { contact_id: 3001, phone: '2025550100' },
      }),
    );

    expect(writes).toEqual([
      {
        method: 'PUT',
        path: 'orgs/1/contacts/3001/',
        body: { phone: '2025550100' },
      },
    ]);
    expect(requireStructuredContent(result)).toMatchObject({
      id: 3001,
      email: 'pat@example.test',
      is_synthetic_email: false,
    });
  });

  it('does not put update_contact when only contact_id is sent', async () => {
    const { client, writes } = recordingClient({});
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'update_contact', arguments: { contact_id: 3001 } }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('rejects an unknown update_contact field before HTTP', async () => {
    const { client, writes } = recordingClient({});
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_contact',
        arguments: { contact_id: 3001, phone: '2025550100', gender: 'x' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });

  it('patches update_project_usage with only the usage object', async () => {
    const monthly = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const { client, writes } = recordingClient({
      id: 1001,
      url: 'https://api.opensolar.com/api/orgs/1/projects/1001/',
      usage: { usage_data_source: 'kwh_monthly', values: monthly },
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project_usage',
        arguments: { project_id: 1001, usage_data_source: 'kwh_monthly', values: monthly },
      }),
    );

    expect(writes).toEqual([
      {
        method: 'PATCH',
        path: 'orgs/1/projects/1001/',
        body: { usage: { usage_data_source: 'kwh_monthly', values: monthly } },
      },
    ]);
    expect(requireStructuredContent(result)).toEqual({
      project_id: 1001,
      usage_data_source: 'kwh_monthly',
    });
    expect(JSON.stringify(requireStructuredContent(result))).not.toContain('url');
  });

  it('sends annual usage as a number and estimate as a string', async () => {
    const { client, writes } = recordingClient({ id: 1001 });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    await withMcpClient(mcp, async (session) => {
      await session.callTool({
        name: 'update_project_usage',
        arguments: { project_id: 1001, usage_data_source: 'kwh_annual', values: 1000 },
      });
      await session.callTool({
        name: 'update_project_usage',
        arguments: { project_id: 1001, usage_data_source: 'estimate', values: 'Low' },
      });
    });

    expect(writes).toEqual([
      {
        method: 'PATCH',
        path: 'orgs/1/projects/1001/',
        body: { usage: { usage_data_source: 'kwh_annual', values: 1000 } },
      },
      {
        method: 'PATCH',
        path: 'orgs/1/projects/1001/',
        body: { usage: { usage_data_source: 'estimate', values: 'Low' } },
      },
    ]);
    expect(JSON.stringify(writes[0]?.body)).not.toContain('[1000]');
  });

  it('rejects usage values that do not match the source before HTTP', async () => {
    const { client, writes } = recordingClient(createdProject);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const results = await withMcpClient(mcp, async (session) => [
      await session.callTool({
        name: 'update_project_usage',
        arguments: {
          project_id: 1001,
          usage_data_source: 'kwh_monthly',
          values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        },
      }),
      await session.callTool({
        name: 'update_project_usage',
        arguments: { project_id: 1001, usage_data_source: 'kwh_annual', values: [1000] },
      }),
      await session.callTool({
        name: 'update_project_usage',
        arguments: { project_id: 1001, usage_data_source: 'estimate', values: 'Huge' },
      }),
      await session.callTool({
        name: 'update_project_usage',
        arguments: {
          project_id: 1001,
          usage_data_source: 'kwh_annual',
          values: 1000,
          address: '12 Example Street',
        },
      }),
    ]);

    expect(results.every((result) => result.isError === true)).toBe(true);
    expect(writes).toEqual([]);
  });

  it('deletes a project and returns id with deleted true when the body is empty', async () => {
    const { client, writes } = recordingClient(null);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_project', arguments: { project_id: 1001 } }),
    );

    expect(writes).toEqual([{ method: 'DELETE', path: 'orgs/1/projects/1001/' }]);
    expect(writes[0]).not.toHaveProperty('body');
    expect(requireStructuredContent(result)).toEqual({ id: 1001, deleted: true });
  });

  it('deletes a contact and returns id with deleted true when the body is empty', async () => {
    const { client, writes } = recordingClient(null);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_contact', arguments: { contact_id: 3001 } }),
    );

    expect(writes).toEqual([{ method: 'DELETE', path: 'orgs/1/contacts/3001/' }]);
    expect(writes[0]).not.toHaveProperty('body');
    expect(requireStructuredContent(result)).toEqual({ id: 3001, deleted: true });
  });

  it('rejects unknown delete fields before HTTP', async () => {
    const { client, writes } = recordingClient(null);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const results = await withMcpClient(mcp, async (session) => [
      await session.callTool({
        name: 'delete_project',
        arguments: { project_id: 1001, address: '12 Example Street' },
      }),
      await session.callTool({
        name: 'delete_contact',
        arguments: { contact_id: 3001, email: 'pat@example.test' },
      }),
    ]);

    expect(results.every((result) => result.isError === true)).toBe(true);
    expect(writes).toEqual([]);
  });
});
