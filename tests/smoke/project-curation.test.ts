import { describe, expect, it } from 'vitest';
import {
  curateProject,
  curateProjectListRow,
  GetProjectCuratedSchema,
  GetProjectOutputSchema,
  ListProjectsOutputSchema,
  ProjectFullSchema,
  ProjectListSchema,
} from '../../src/schemas/project.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

describe('project curation', () => {
  it('drops passport and licence fields from the default list_projects page', async () => {
    const list = ProjectListSchema.parse(loadOpenSolarFixture('projects', 'list'));
    const first = list[0];
    if (first === undefined) {
      throw new Error('list fixture is empty');
    }
    const row = curateProjectListRow(first);
    expect(row).toMatchObject({
      id: 1001,
      stage_milestone: 'Presale',
      workflow: { workflow_id: 200, active_stage_id: 501 },
    });
    expect(row).not.toHaveProperty('contacts_data');

    const mcp = buildServer({
      client: testClient(async () => loadOpenSolarFixture('projects', 'list')),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_projects', arguments: {} }),
    );
    const payload = requireStructuredContent(result);
    const serialized = JSON.stringify(payload);

    expect(result.isError).toBeFalsy();
    expect(ListProjectsOutputSchema.parse(payload)).toEqual(payload);
    expect(payload).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 20,
        projects: [
          expect.objectContaining({
            id: 1001,
            workflow: expect.objectContaining({ active_stage_id: 501 }),
          }),
        ],
      }),
    );
    expect(serialized).not.toContain('PTEST123456');
    expect(serialized).not.toContain('LTEST654321');
    expect(serialized).not.toContain('passport_number');
    expect(serialized).not.toContain('licence_number');
  });

  it('adds workflow ids and Presale to curated get_project', async () => {
    const project = ProjectFullSchema.parse(loadOpenSolarFixture('projects', 'detail'));
    const curated = curateProject(project);

    expect(curated).toMatchObject({
      id: 1001,
      stage: 0,
      stage_milestone: 'Presale',
      workflow: { workflow_id: 200, active_stage_id: 501 },
      system_count: 1,
      design_available: false,
      contacts: [
        { id: 3001, display: 'Pat Example', email: 'pat@example.test', phone: '2025550100' },
      ],
    });
    expect(curated.events).toEqual([]);

    const mcp = buildServer({
      client: testClient(async () => loadOpenSolarFixture('projects', 'detail')),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_project', arguments: { id: 1001 } }),
    );
    const payload = requireStructuredContent(result);

    expect(GetProjectCuratedSchema.parse(payload)).toEqual(payload);
    expect(GetProjectOutputSchema.parse(payload)).toEqual(payload);
    expect(payload).toEqual(
      expect.objectContaining({
        workflow: { workflow_id: 200, active_stage_id: 501 },
        stage_milestone: 'Presale',
        contacts: expect.any(Array),
        system_count: 1,
        design_available: false,
        events: [],
      }),
    );
  });

  it('replaces verbose project design with [REDACTED]', async () => {
    const detail = loadOpenSolarFixture('projects', 'detail');
    if (detail === null || typeof detail !== 'object' || Array.isArray(detail)) {
      throw new Error('detail fixture must be an object');
    }
    const withDesign = { ...detail, design: 'H4sIfake-compressed-design' };
    const mcp = buildServer({
      client: testClient(async () => withDesign),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_project', arguments: { id: 1001, verbose: true } }),
    );
    const payload = requireStructuredContent(result);
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('expected a redacted project object');
    }

    expect(GetProjectOutputSchema.parse(payload)).toEqual(payload);
    expect(payload).toEqual(expect.objectContaining({ id: 1001, design: '[REDACTED]' }));
    expect(JSON.stringify(payload)).not.toContain('H4sIfake-compressed-design');
    const text = result.content[0];
    if (text?.type !== 'text') {
      throw new Error('expected text content');
    }
    expect(text.text).toContain('Full redacted');
  });
});
