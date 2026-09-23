import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('get_project_snapshot', () => {
  it('assembles project, workflow, systems, and embedded files without design or urls', async () => {
    const project = {
      ...(loadOpenSolarFixture('projects', 'detail') as Record<string, unknown>),
      payment_option_sold: 7,
      private_files_data: [
        {
          id: 9,
          title: 'Proposal',
          file_tags_data: [{ title: 'Proposal' }],
          file_contents: 'https://files.example.test/secret',
        },
      ],
      shared_with: [
        { org_id: 4, is_shared: true, permission: 'https://api.example.test/roles/1/' },
      ],
      events_data: [
        {
          id: 8,
          event_type_id: 1,
          title: 'Call',
          created_date: '2026-02-01T00:00:00Z',
          start: '2026-02-01T00:00:00Z',
        },
      ],
    };
    const paths: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        paths.push(path);
        if (path === 'orgs/1/projects/1001/') {
          return project;
        }
        if (path === 'orgs/1/workflows/200/') {
          return {
            id: 200,
            title: 'Example Workflow',
            workflow_stages: [{ id: 501, title: 'Designing', milestone: 0, order: 0 }],
          };
        }
        if (path.startsWith('orgs/1/systems/')) {
          return loadOpenSolarFixture('systems', 'list');
        }
        if (path === 'orgs/1/payment_options/7/') {
          return loadOpenSolarFixture('payments', 'detail');
        }
        throw new Error(`unexpected read ${path}`);
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_snapshot', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      project: { id: number; stage_milestone?: string };
      contacts: Array<{ display?: string | null; email?: string; is_synthetic_email: boolean }>;
      workflow: { title?: string; active_stage_title?: string; milestone?: string };
      usage: { usage_data_source: string; period?: string; annual_total?: number };
      systems: { systems: Array<{ id: number; price_including_tax?: number }> };
      payment_option: { id: number };
      files: {
        returned_count: number;
        total_count: number | null;
        files: Array<{ title?: string; file_tags: string[] }>;
      };
      shared_with: Array<Record<string, unknown>>;
      events: Array<{ event_type_name: string }>;
    };
    const serialized = JSON.stringify(payload);

    expect(paths.some((path) => path.includes('private_files'))).toBe(false);
    expect(payload.project).toMatchObject({ id: 1001, stage_milestone: 'Presale' });
    expect(payload.contacts[0]).toMatchObject({
      display: 'Pat Example',
      email: 'pat@example.test',
      is_synthetic_email: false,
    });
    expect(payload.workflow).toMatchObject({
      workflow_id: 200,
      title: 'Example Workflow',
      active_stage_title: 'Designing',
      milestone: 'Presale',
    });
    expect(payload.usage).toEqual({
      usage_data_source: 'kwh_annual',
      period: 'annual',
      unit: 'kwh',
      period_count: 1,
      annual_total: 8000,
    });
    expect(payload.systems.systems[0]).toMatchObject({ id: 1253, kw_stc: 2.76 });
    expect(payload.systems.systems[0]).not.toHaveProperty('price_including_tax');
    expect(payload.payment_option.id).toBe(7);
    expect(payload.files).toMatchObject({
      returned_count: 1,
      total_count: 1,
      list_complete: true,
      files: [{ title: 'Proposal', file_tags: ['Proposal'] }],
    });
    expect(payload.shared_with).toEqual([{ org_id: 4, is_shared: true }]);
    expect(payload.events[0]?.event_type_name).toBeTypeOf('string');
    expect(serialized).not.toContain('file_contents');
    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('configuration');
  });

  it('keeps the other sections when the systems read fails', async () => {
    const project = loadOpenSolarFixture('projects', 'detail');
    const mcp = buildServer({
      client: testClient(async (path) => {
        if (path === 'orgs/1/projects/1001/') {
          return {
            ...(project as Record<string, unknown>),
            private_files_data: [],
          };
        }
        if (path === 'orgs/1/workflows/200/') {
          return {
            id: 200,
            title: 'Example Workflow',
            workflow_stages: [{ id: 501, title: 'Designing', milestone: 0 }],
          };
        }
        if (path.startsWith('orgs/1/systems/')) {
          throw new OpenSolarApiError('nope', 404, '');
        }
        throw new Error(`unexpected read ${path}`);
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });
    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_snapshot', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      project: { id: number };
      systems: { gap?: string; systems?: unknown[] };
      files: { returned_count: number; total_count: number | null; list_complete: boolean };
    };
    expect(payload.project.id).toBe(1001);
    expect(payload.systems).toEqual({ gap: 'The record was not found' });
    expect(payload.files).toEqual({
      returned_count: 0,
      total_count: 0,
      files: [],
      list_complete: true,
    });
  });

  it('keeps monthly kWh as twelve values plus an annual total', async () => {
    const monthly = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const payload = await snapshotWithUsage('kwh_monthly', monthly);
    expect(payload.usage).toEqual({
      usage_data_source: 'kwh_monthly',
      period: 'monthly',
      unit: 'kwh',
      period_count: 12,
      values: monthly,
      annual_total: 1200,
    });
  });

  it('does not sum daily consumption per month into an annual total', async () => {
    const daily = [3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4];
    const payload = await snapshotWithUsage('kwh_daily_per_month', daily);
    expect(payload.usage).toEqual({
      usage_data_source: 'kwh_daily_per_month',
      period: 'daily_per_month',
      unit: 'kwh',
      period_count: 12,
      values: daily,
    });
    expect(payload.usage).not.toHaveProperty('annual_total');
  });

  it('reports an unknown total when the private-files page is full', async () => {
    const files = await snapshotFiles(5);
    expect(files).toMatchObject({
      returned_count: 5,
      total_count: null,
      list_complete: false,
    });
    expect(files.files).toHaveLength(5);
  });

  it('reports a known total when the private-files page ends early', async () => {
    const files = await snapshotFiles(2);
    expect(files).toEqual({
      returned_count: 2,
      total_count: 2,
      list_complete: true,
      files: [
        { title: 'File 1', file_tags: [] },
        { title: 'File 2', file_tags: [] },
      ],
    });
  });

  it('starts the workflow, payment, and file reads together', async () => {
    const project = {
      ...(loadOpenSolarFixture('projects', 'detail') as Record<string, unknown>),
      payment_option_sold: 7,
    };
    const trace: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        const kind = optionalRead(path);
        if (kind !== null) {
          trace.push(`start:${kind}`);
          await new Promise((resolve) => setTimeout(resolve, 30));
          trace.push(`end:${kind}`);
        }
        if (path === 'orgs/1/projects/1001/') {
          return project;
        }
        if (path === 'orgs/1/workflows/200/') {
          return {
            id: 200,
            title: 'Example Workflow',
            workflow_stages: [{ id: 501, title: 'Designing', milestone: 0 }],
          };
        }
        if (path.startsWith('orgs/1/systems/')) {
          return [];
        }
        if (path === 'orgs/1/payment_options/7/') {
          throw new OpenSolarApiError('nope', 404, '');
        }
        if (path.includes('private_files')) {
          return [{ id: 1, title: 'Site photo', file_tags_data: [] }];
        }
        throw new Error(`unexpected read ${path}`);
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });
    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'get_project_snapshot', arguments: { project_id: 1001 } }),
    );
    const payload = requireStructuredContent(result) as {
      workflow: { active_stage_title?: string };
      payment_option: { gap?: string };
      files: { total_count: number | null };
      contacts: Array<{ display?: string | null }>;
    };
    const firstEnd = trace.findIndex((entry) => entry.startsWith('end:'));
    expect(trace.slice(0, firstEnd).sort()).toEqual([
      'start:files',
      'start:payment',
      'start:workflow',
    ]);
    expect(payload.workflow.active_stage_title).toBe('Designing');
    expect(payload.payment_option).toEqual({ gap: 'The record was not found' });
    expect(payload.files.total_count).toBe(1);
    expect(payload.contacts[0]?.display).toBe('Pat Example');
  });
});

function optionalRead(path: string): 'workflow' | 'payment' | 'files' | null {
  if (path.startsWith('orgs/1/workflows/')) {
    return 'workflow';
  }
  if (path.startsWith('orgs/1/payment_options/')) {
    return 'payment';
  }
  if (path.includes('private_files')) {
    return 'files';
  }
  return null;
}

async function snapshotWithUsage(source: string, values: number[]) {
  const project = {
    ...(loadOpenSolarFixture('projects', 'detail') as Record<string, unknown>),
    usage: { usage_data_source: source, values },
    private_files_data: [],
  };
  const mcp = buildServer({
    client: testClient(async (path) => {
      if (path === 'orgs/1/projects/1001/') {
        return project;
      }
      if (path === 'orgs/1/workflows/200/') {
        return { id: 200, title: 'Example Workflow', workflow_stages: [] };
      }
      if (path.startsWith('orgs/1/systems/')) {
        return [];
      }
      throw new Error(`unexpected read ${path}`);
    }),
    orgId: 1,
    filters: ALL_TOOL_FILTERS,
  });
  const result = await withMcpClient(mcp, (session) =>
    session.callTool({ name: 'get_project_snapshot', arguments: { project_id: 1001 } }),
  );
  return requireStructuredContent(result) as {
    usage: Record<string, unknown>;
  };
}

async function snapshotFiles(count: number) {
  const project = loadOpenSolarFixture('projects', 'detail') as Record<string, unknown>;
  const page = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `File ${index + 1}`,
    file_tags_data: [],
  }));
  const mcp = buildServer({
    client: testClient(async (path) => {
      if (path === 'orgs/1/projects/1001/') {
        return project;
      }
      if (path === 'orgs/1/workflows/200/') {
        return { id: 200, title: 'Example Workflow', workflow_stages: [] };
      }
      if (path.startsWith('orgs/1/systems/')) {
        return [];
      }
      if (path.includes('private_files')) {
        return page;
      }
      throw new Error(`unexpected read ${path}`);
    }),
    orgId: 1,
    filters: ALL_TOOL_FILTERS,
  });
  const result = await withMcpClient(mcp, (session) =>
    session.callTool({ name: 'get_project_snapshot', arguments: { project_id: 1001 } }),
  );
  const payload = requireStructuredContent(result) as {
    files: {
      returned_count: number;
      total_count: number | null;
      list_complete: boolean;
      files: Array<{ title?: string | null; file_tags: string[] }>;
    };
  };
  return payload.files;
}
