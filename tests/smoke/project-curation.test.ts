import { describe, expect, it } from 'vitest';
import {
  curateProject,
  curateProjectListRow,
  ProjectFullSchema,
  ProjectListSchema,
} from '../../src/schemas/project.js';
import { buildServer } from '../../src/server.js';
import { loadOpenSolarFixture } from '../fixtures/load-fixture.js';
import { ALL_TOOL_FILTERS, withMcpClient } from '../helpers/mcp.js';

function parseToolJson(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const block = result.content[0];
  if (block?.type !== 'text' || typeof block.text !== 'string') {
    throw new Error('expected text content');
  }
  return JSON.parse(block.text);
}

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
      client: {
        get: async () => loadOpenSolarFixture('projects', 'list'),
      },
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'list_projects', arguments: {} }),
    );
    const payload = parseToolJson(result);
    const serialized = JSON.stringify(payload);

    expect(result.isError).toBeFalsy();
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
      client: {
        get: async () => loadOpenSolarFixture('projects', 'detail'),
      },
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (client) =>
      client.callTool({ name: 'get_project', arguments: { id: 1001 } }),
    );
    const payload = parseToolJson(result);

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
});
