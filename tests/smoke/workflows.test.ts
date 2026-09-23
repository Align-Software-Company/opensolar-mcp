import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import { DeletedRecordSchema } from '../../src/schemas/project.js';
import { CuratedWorkflowSchema, ListWorkflowsOutputSchema } from '../../src/schemas/workflow.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('list_workflows', () => {
  it('requests one page and drops action payloads', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('workflows', 'list');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_workflows', arguments: {} }),
    );
    const payload = ListWorkflowsOutputSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/workflows/?page=1&limit=20']);
    expect(payload.workflows).toEqual([
      {
        id: 3,
        title: 'Example Workflow',
        is_default: true,
        is_archived: false,
        workflow_stages: [{ id: 17, title: 'New', milestone: 0, order: 0 }],
      },
    ]);
    expect(serialized).not.toContain('actions');
    expect(serialized).not.toContain('Design Systems');
  });
});

describe('get_workflow', () => {
  it('returns one curated workflow and drops actions', async () => {
    const calls: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        return loadOpenSolarFixture('workflows', 'detail');
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_workflow', arguments: { id: 3 } }),
    );
    const payload = CuratedWorkflowSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(calls).toEqual(['orgs/1/workflows/3/']);
    expect(payload).toEqual({
      id: 3,
      title: 'Example Workflow',
      is_default: true,
      is_archived: false,
      workflow_stages: [{ id: 17, title: 'New', milestone: 0, order: 0 }],
    });
    expect(serialized).not.toContain('actions');
    expect(serialized).not.toContain('Design Systems');
  });
});

type WriteCall = { method: 'POST' | 'DELETE'; path: string; body?: unknown };

function writeClient(response: unknown): { client: OpenSolarClient; writes: WriteCall[] } {
  const writes: WriteCall[] = [];
  const client = testClient(async () => {
    throw new Error('unexpected OpenSolar read');
  });
  client.post = async (path, body) => {
    writes.push({ method: 'POST', path, body });
    return response;
  };
  client.delete = async (path) => {
    writes.push({ method: 'DELETE', path });
    return null;
  };
  return { client, writes };
}

describe('create_workflow', () => {
  it('posts the sample fields and returns curated stages', async () => {
    const { client, writes } = writeClient(loadOpenSolarFixture('workflows', 'detail'));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_workflow',
        arguments: {
          title: 'My New Workflow',
          is_default: true,
          description: 'A description for My New Workflow.',
        },
      }),
    );
    const payload = CuratedWorkflowSchema.parse(requireStructuredContent(result));
    const serialized = JSON.stringify(payload);

    expect(writes).toEqual([
      {
        method: 'POST',
        path: 'orgs/1/workflows/',
        body: {
          title: 'My New Workflow',
          is_default: true,
          description: 'A description for My New Workflow.',
        },
      },
    ]);
    expect(payload.workflow_stages).toEqual([{ id: 17, title: 'New', milestone: 0, order: 0 }]);
    expect(serialized).not.toContain('actions');
    expect(serialized).not.toContain('Design Systems');
    expect(serialized).not.toContain('Dropped from the curated row');
  });

  it('omits unset fields and rejects unknown fields before HTTP', async () => {
    const { client, writes } = writeClient(loadOpenSolarFixture('workflows', 'detail'));
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const results = await withMcpClient(mcp, async (session) => [
      await session.callTool({
        name: 'create_workflow',
        arguments: { title: 'My New Workflow' },
      }),
      await session.callTool({
        name: 'create_workflow',
        arguments: { title: 'My New Workflow', workflow_stages: [] },
      }),
    ]);

    expect(results[1]?.isError).toBe(true);
    expect(writes).toEqual([
      {
        method: 'POST',
        path: 'orgs/1/workflows/',
        body: { title: 'My New Workflow' },
      },
    ]);
  });
});

describe('delete_workflow', () => {
  it('deletes one workflow and drops the upstream body', async () => {
    const { client, writes } = writeClient(null);
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_workflow', arguments: { id: 3 } }),
    );
    const payload = DeletedRecordSchema.parse(requireStructuredContent(result));

    expect(writes).toEqual([{ method: 'DELETE', path: 'orgs/1/workflows/3/' }]);
    expect(payload).toEqual({ id: 3, deleted: true });
  });
});
