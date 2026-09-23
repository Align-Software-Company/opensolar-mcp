import { describe, expect, it } from 'vitest';
import type { OpenSolarClient } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

type WriteCall = { method: string; path: string; body?: unknown };

function stageClient(reads: Record<string, unknown>): {
  client: OpenSolarClient;
  reads: string[];
  writes: WriteCall[];
} {
  const seen: string[] = [];
  const writes: WriteCall[] = [];
  const client = testClient(async (path) => {
    seen.push(path);
    const body = reads[path];
    if (body === undefined) {
      throw new Error(`unexpected read ${path}`);
    }
    return body;
  });
  client.patch = async (path, body) => {
    writes.push({ method: 'PATCH', path, body });
    return { id: 1001 };
  };
  return { client, reads: seen, writes };
}

const workflow = {
  id: 200,
  title: 'Example Workflow',
  workflow_stages: [
    { id: 501, title: 'Designing', milestone: 0, order: 0 },
    { id: 502, title: 'Sold', milestone: 2, order: 1 },
    { id: 503, title: 'sold', milestone: 2, order: 2 },
  ],
};

const project = {
  id: 1001,
  workflow: { workflow_id: 200, active_stage_id: 501 },
};

describe('update_project_stage by title', () => {
  it('patches the unique stage id', async () => {
    const { client, reads, writes } = stageClient({
      'orgs/1/projects/1001/': project,
      'orgs/1/workflows/200/': workflow,
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });
    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project_stage',
        arguments: { project_id: 1001, stage_name: 'Designing' },
      }),
    );
    expect(reads).toEqual(['orgs/1/projects/1001/', 'orgs/1/workflows/200/']);
    expect(writes).toEqual([
      {
        method: 'PATCH',
        path: 'orgs/1/projects/1001/',
        body: {
          workflow: { active_stage_id: 501, workflow_id: 200 },
          active_stage_id: 501,
        },
      },
    ]);
    expect(requireStructuredContent(result)).toEqual({
      project_id: 1001,
      workflow_id: 200,
      active_stage_id: 501,
    });
  });

  it('names the stages that exist when the title is unknown', async () => {
    const { client, writes } = stageClient({
      'orgs/1/workflows/200/': workflow,
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });
    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project_stage',
        arguments: { project_id: 1001, workflow_id: 200, stage_name: 'Installed' },
      }),
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Designing');
    expect(writes).toEqual([]);
  });

  it('does not patch when two stages share a title', async () => {
    const { client, writes } = stageClient({
      'orgs/1/workflows/200/': workflow,
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });
    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_project_stage',
        arguments: { project_id: 1001, workflow_id: 200, stage_name: 'Sold' },
      }),
    );
    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  });
});
