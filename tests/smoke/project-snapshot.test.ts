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
      contacts: Array<{ email?: string; is_synthetic_email: boolean }>;
      workflow: { title?: string; active_stage_title?: string; milestone?: string };
      usage: { summary: string };
      systems: { systems: Array<{ id: number; price_including_tax?: number }> };
      payment_option: { id: number };
      files: { count: number; files: Array<{ title?: string; file_tags: string[] }> };
      shared_with: Array<Record<string, unknown>>;
      events: Array<{ event_type_name: string }>;
    };
    const serialized = JSON.stringify(payload);

    expect(paths.some((path) => path.includes('private_files'))).toBe(false);
    expect(payload.project).toMatchObject({ id: 1001, stage_milestone: 'Presale' });
    expect(payload.contacts[0]).toMatchObject({
      email: 'pat@example.test',
      is_synthetic_email: false,
    });
    expect(payload.workflow).toMatchObject({
      workflow_id: 200,
      title: 'Example Workflow',
      active_stage_title: 'Designing',
      milestone: 'Presale',
    });
    expect(payload.usage.summary).toBe('8000 per year');
    expect(payload.systems.systems[0]).toMatchObject({ id: 1253, kw_stc: 2.76 });
    expect(payload.systems.systems[0]).not.toHaveProperty('price_including_tax');
    expect(payload.payment_option.id).toBe(7);
    expect(payload.files).toMatchObject({
      count: 1,
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
      files: { count: number };
    };
    expect(payload.project.id).toBe(1001);
    expect(payload.systems).toEqual({ gap: 'The record was not found' });
    expect(payload.files).toEqual({ count: 0, files: [], list_complete: true });
  });
});
