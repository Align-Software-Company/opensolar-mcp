import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { ProjectDesignOutputSchema } from '../../src/schemas/design.js';
import {
  asArray,
  asRecord,
  callLiveTool,
  callLiveToolResult,
  liveOpenSolarClient,
  liveOrgId,
  liveReads,
  positiveId,
  textField,
  traceClient,
} from './support.js';

const SECRET_KEYS = new Set([
  'design',
  'configuration_json',
  'api_key',
  'api_key_chat',
  'token',
  'password',
  'file_contents',
]);

function forbiddenSnapshotValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => forbiddenSnapshotValues(entry));
  }
  if (typeof value !== 'object' || value === null) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      return ['url'];
    }
    return [];
  }
  const found: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) {
      found.push(key);
    }
    found.push(...forbiddenSnapshotValues(child));
  }
  return found;
}

function toolText(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((block) => {
      if (typeof block !== 'object' || block === null || !('text' in block)) {
        return '';
      }
      const text = block.text;
      return typeof text === 'string' ? text : '';
    })
    .join(' ');
}

function searchReport(value: unknown): {
  complete: boolean;
  stopped_by: string;
  pages_scanned: number;
} {
  const search = asRecord(asRecord(value).search);
  return {
    complete: search.complete === true,
    stopped_by: String(search.stopped_by),
    pages_scanned: typeof search.pages_scanned === 'number' ? search.pages_scanned : -1,
  };
}

describe.skipIf(!liveReads)('live agent reads', () => {
  it('finds a listed contact through search_contacts', async () => {
    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const contacts = asArray(await client.get(`orgs/${orgId}/contacts/?page=1&limit=20`));
    const source = contacts
      .map(asRecord)
      .find((row) => positiveId(row.id) !== undefined && textField(row.email) !== undefined);
    const contactId = source === undefined ? undefined : positiveId(source.id);
    const query = source === undefined ? undefined : textField(source.email);
    if (contactId === undefined || query === undefined) {
      throw new Error('no listed contact had an email to search');
    }

    const payload = asRecord(await callLiveTool(client, 'search_contacts', { query }));
    const report = searchReport(payload);
    expect(report.pages_scanned).toBeGreaterThan(0);
    expect(report.stopped_by).toBe(report.complete ? 'end' : 'max_pages');
    const found = asArray(payload.matches).some(
      (row) => positiveId(asRecord(row).id) === contactId,
    );
    if (report.complete || found) {
      expect(found).toBe(true);
    }
  });

  it('finds a listed project through search_projects', async () => {
    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const projects = asArray(await client.get(`orgs/${orgId}/projects/?page=1&limit=20`)).map(
      asRecord,
    );
    const source = projects.find((row) => {
      const title = textField(row.title);
      return positiveId(row.id) !== undefined && title !== undefined && title.length >= 3;
    });
    const projectId = source === undefined ? undefined : positiveId(source.id);
    const query = source === undefined ? undefined : textField(source.title);
    if (projectId === undefined || query === undefined) {
      throw new Error('no listed project had a title to search');
    }

    const payload = asRecord(await callLiveTool(client, 'search_projects', { query }));
    const report = searchReport(payload);
    expect(report.pages_scanned).toBeGreaterThan(0);
    expect(report.stopped_by).toBe(report.complete ? 'end' : 'max_pages');
    const found = asArray(payload.matches).some(
      (row) => positiveId(asRecord(row).id) === projectId,
    );
    if (report.complete || found) {
      expect(found).toBe(true);
    }
  });

  it('returns a project snapshot without design, file URLs, or secrets', async () => {
    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const projects = asArray(await client.get(`orgs/${orgId}/projects/?page=1&limit=5`)).map(
      asRecord,
    );
    const projectId = positiveId(projects[0]?.id);
    if (projectId === undefined) {
      throw new Error('the org has no project to snapshot');
    }

    const payload = asRecord(
      await callLiveTool(client, 'get_project_snapshot', { project_id: projectId }),
    );
    expect(asRecord(payload.project).id).toBe(projectId);
    expect(forbiddenSnapshotValues(payload)).toEqual([]);

    const detail = asRecord(await client.get(`orgs/${orgId}/projects/${projectId}/`));
    const workflowId = positiveId(asRecord(detail.workflow ?? {}).workflow_id);
    if (workflowId === undefined) {
      return;
    }
    const failing = traceClient(client);
    const originalGet = failing.get.bind(failing);
    failing.get = async (path, options) => {
      if (path.includes('/workflows/')) {
        throw new OpenSolarApiError('missing', 404, '');
      }
      return originalGet(path, options);
    };
    const gapped = asRecord(
      await callLiveTool(failing, 'get_project_snapshot', { project_id: projectId }),
    );
    expect(asRecord(gapped.workflow).gap).toEqual(expect.any(String));
    expect(asRecord(gapped.project).id).toBe(projectId);
  });

  it('compares systems for one project and makes at most one details call', async (ctx) => {
    const inner = liveOpenSolarClient();
    const orgId = liveOrgId();
    const projects = asArray(await inner.get(`orgs/${orgId}/projects/?page=1&limit=5`)).map(
      asRecord,
    );
    let projectId: number | undefined;
    let listed: unknown[] = [];
    for (const project of projects) {
      const id = positiveId(project.id);
      if (id === undefined) {
        continue;
      }
      const page = asArray(
        await inner.get(`orgs/${orgId}/systems/?fieldset=list&project=${id}&page=1&limit=100`),
      );
      if (page.length > 0) {
        projectId = id;
        listed = page;
        break;
      }
    }
    if (projectId === undefined) {
      ctx.skip('no project in the first five list rows has a system');
      return;
    }

    const traced = traceClient(inner);
    const payload = asRecord(
      await callLiveTool(traced, 'compare_project_systems', { project_id: projectId }),
    );
    const comparedIds = asArray(payload.systems).map((row) => positiveId(asRecord(row).id));
    const listedIds = listed.map((row) => positiveId(asRecord(row).id));
    expect(comparedIds).toEqual(listedIds);
    const needsDetails = listed.some((row) => {
      const system = asRecord(row);
      return system.modules == null || system.inverters == null || system.batteries == null;
    });
    const detailsCalls = traced.calls.filter((call) => call.includes('/systems/details/'));
    expect(detailsCalls.length).toBe(needsDetails ? 1 : 0);
    if (payload.hardware_gap !== undefined) {
      expect(typeof payload.hardware_gap).toBe('string');
    }
  });

  it('preflights a share only when a connected org id is configured', async (ctx) => {
    const raw = process.env.OPENSOLAR_TEST_CONNECTED_ORG_ID;
    if (raw === undefined || raw === '') {
      ctx.skip('OPENSOLAR_TEST_CONNECTED_ORG_ID is not set');
      return;
    }
    const targetOrgId = Number(raw);
    if (!Number.isInteger(targetOrgId) || targetOrgId <= 0) {
      throw new Error('OPENSOLAR_TEST_CONNECTED_ORG_ID must be a positive integer');
    }
    const inner = liveOpenSolarClient();
    const orgId = liveOrgId();
    const projects = asArray(await inner.get(`orgs/${orgId}/projects/?page=1&limit=1`)).map(
      asRecord,
    );
    const projectId = positiveId(projects[0]?.id);
    if (projectId === undefined) {
      throw new Error('the org has no project for share preflight');
    }
    const traced = traceClient(inner);
    const payload = asRecord(
      await callLiveTool(traced, 'preflight_project_share', {
        project_id: projectId,
        target_org_id: targetOrgId,
      }),
    );
    const connection = asRecord(payload.connection);
    if (connection.status === 'ready') {
      expect(connection.is_active).toBe(true);
      expect(connection.is_other_active).toBe(true);
      expect(connection.is_other_enabled).toBe(true);
    }
    if (connection.status === 'not_ready') {
      expect([
        connection.is_active,
        connection.is_other_active,
        connection.is_other_enabled,
      ]).toContain(false);
    }
    const filtered = traced.calls.filter((call) =>
      /\/(payment_options|pricing_schemes|costings|component_module_activations)\//.test(call),
    );
    for (const call of filtered) {
      expect(call).toContain('fieldset=list');
      expect(call).toContain(`shared_with=${targetOrgId}`);
    }
    expect(traced.calls.some((call) => call.startsWith('PUT ') || call.startsWith('POST '))).toBe(
      false,
    );
    expect(traced.calls.some((call) => call.includes('/bulk/'))).toBe(false);
  });

  it('reads mapped design sections when Raw Data is available', async (ctx) => {
    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const projects = asArray(await client.get(`orgs/${orgId}/projects/?page=1&limit=5`)).map(
      asRecord,
    );
    let sawDesign = false;
    for (const project of projects) {
      const projectId = positiveId(project.id);
      if (projectId === undefined) {
        continue;
      }
      const result = await callLiveToolResult(client, 'get_project_design', {
        project_id: projectId,
        section: 'summary',
      });
      const text = toolText(result.content);
      if (result.isError) {
        if (text.includes('Raw Data')) {
          ctx.skip('this org does not have Raw Data API Access');
          return;
        }
        throw new Error('get_project_design failed');
      }
      const summary = ProjectDesignOutputSchema.parse(result.structuredContent);
      if (!summary.design_available) {
        continue;
      }
      sawDesign = true;
      expect(summary.section).toBe('summary');
      for (const section of ['components', 'energy'] as const) {
        const sectionResult = await callLiveToolResult(client, 'get_project_design', {
          project_id: projectId,
          section,
        });
        if (sectionResult.isError) {
          throw new Error(`get_project_design ${section} failed`);
        }
        const decoded = ProjectDesignOutputSchema.parse(sectionResult.structuredContent);
        expect(decoded).toMatchObject({ design_available: true, section, unmapped: true });
      }
      const geometry = ProjectDesignOutputSchema.parse(
        (
          await callLiveToolResult(client, 'get_project_design', {
            project_id: projectId,
            section: 'geometry',
          })
        ).structuredContent,
      );
      expect(JSON.stringify(geometry)).not.toContain('coordinates');
      break;
    }
    if (!sawDesign) {
      ctx.skip('no project in the first five list rows had a design payload');
    }
  });
});
