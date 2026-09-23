import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

function connection(id: number, partnerOrgId: number, isActive = true) {
  return {
    id,
    org_name: 'Partner',
    org_to: `https://api.opensolar.com/api/orgs/${partnerOrgId}/`,
    is_active: isActive,
    is_other_active: true,
    is_other_enabled: true,
    permission: 'https://api.opensolar.com/api/orgs/1/permissions_role/3/',
    notify_roles: [],
  };
}

function resource(
  payload: { resources: Array<Record<string, unknown>> },
  name: string,
): Record<string, unknown> {
  const row = payload.resources.find((item) => item.resource === name);
  if (row === undefined) {
    throw new Error(`missing resource ${name}`);
  }
  return row;
}

describe('preflight_project_share', () => {
  it('reports an active connection and leaves entity share unknown', async () => {
    const paths: string[] = [];
    const mcp = buildServer({
      client: testClient(async (path) => {
        paths.push(path);
        if (path.startsWith('orgs/1/connected_orgs/')) {
          return [connection(11, 894)];
        }
        if (path === 'orgs/1/projects/1001/') {
          return {
            id: 1001,
            shared_with: [{ org_id: 894, is_shared: true }],
            payment_option_sold: 7,
            costing: null,
            costing_override: null,
          };
        }
        if (path.startsWith('orgs/1/systems/')) {
          return [
            {
              id: 1253,
              pricing_scheme: 'https://api.opensolar.com/api/orgs/1/pricing_schemes/1408/',
              modules: [{ module_activation_id: 613, code: 'JKM285M-60', quantity: 8 }],
              inverters: [],
              batteries: [],
            },
          ];
        }
        throw new Error(`unexpected read ${path}`);
      }),
      orgId: 1,
      filters: ALL_TOOL_FILTERS,
    });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'preflight_project_share',
        arguments: { project_id: 1001, target_org_id: 894 },
      }),
    );
    const payload = requireStructuredContent(result) as {
      connection: { status: string; connection_id?: number };
      project_share: { status: string };
      resources: Array<Record<string, unknown>>;
    };

    expect(paths.every((path) => !path.includes('/bulk/'))).toBe(true);
    expect(payload.connection).toMatchObject({
      status: 'active',
      connection_id: 11,
      is_active: true,
    });
    expect(payload.project_share.status).toBe('shared');
    expect(resource(payload, 'payment_option')).toMatchObject({
      referenced: 'yes',
      ids: [7],
      share: 'unknown',
    });
    expect(resource(payload, 'pricing_scheme')).toMatchObject({
      referenced: 'yes',
      ids: [1408],
      share: 'unknown',
    });
    expect(resource(payload, 'costing')).toMatchObject({ referenced: 'no', share: 'unknown' });
    expect(resource(payload, 'component_module_activation')).toMatchObject({
      referenced: 'yes',
      ids: [613],
      share: 'unknown',
    });
    expect(resource(payload, 'component_inverter_activation').share).toBe('unknown');
    expect(resource(payload, 'component_inverter_activation').referenced).toBe('unknown');
  });

  it('does not treat a missing connection or an empty share list as unknown', async () => {
    const mcp = buildServer({
      client: testClient(async (path) => {
        if (path.startsWith('orgs/1/connected_orgs/')) {
          return [connection(11, 50)];
        }
        if (path === 'orgs/1/projects/1001/') {
          return { id: 1001, shared_with: [], payment_option_sold: null };
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
      session.callTool({
        name: 'preflight_project_share',
        arguments: { project_id: 1001, target_org_id: 894 },
      }),
    );
    const payload = requireStructuredContent(result) as {
      connection: { status: string };
      project_share: { status: string };
      resources: Array<Record<string, unknown>>;
    };
    expect(payload.connection.status).toBe('not_connected');
    expect(payload.project_share.status).toBe('not_shared');
    expect(resource(payload, 'payment_option')).toMatchObject({
      referenced: 'no',
      share: 'unknown',
    });
    expect(resource(payload, 'pricing_scheme').referenced).toBe('no');
  });

  it('does not call a full connection page proof that the org is absent', async () => {
    const calls: string[] = [];
    const page = Array.from({ length: 100 }, (_, index) => connection(index + 1, 5000 + index));
    const mcp = buildServer({
      client: testClient(async (path) => {
        calls.push(path);
        if (path.startsWith('orgs/1/connected_orgs/')) {
          return page;
        }
        if (path === 'orgs/1/projects/1001/') {
          return { id: 1001 };
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
      session.callTool({
        name: 'preflight_project_share',
        arguments: { project_id: 1001, target_org_id: 894 },
      }),
    );
    const payload = requireStructuredContent(result) as {
      connection: { status: string; list_complete: boolean };
      project_share: { status: string };
    };
    expect(calls.filter((path) => path.startsWith('orgs/1/connected_orgs/'))).toHaveLength(3);
    expect(payload.connection.status).toBe('unknown');
    expect(payload.connection.list_complete).toBe(false);
    expect(payload.project_share.status).toBe('unknown');
  });

  it('treats is_shared false as not shared and two matches as ambiguous', async () => {
    const mcp = buildServer({
      client: testClient(async (path) => {
        if (path.startsWith('orgs/1/connected_orgs/')) {
          return [connection(11, 894), connection(12, 894, false)];
        }
        if (path === 'orgs/1/projects/1001/') {
          return { id: 1001, shared_with: [{ org_id: 894, is_shared: false }] };
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
      session.callTool({
        name: 'preflight_project_share',
        arguments: { project_id: 1001, target_org_id: 894 },
      }),
    );
    const payload = requireStructuredContent(result) as {
      connection: { status: string; connection_ids?: number[] };
      project_share: { status: string };
    };
    expect(payload.connection.status).toBe('ambiguous');
    expect(payload.connection.connection_ids).toEqual([11, 12]);
    expect(payload.project_share.status).toBe('not_shared');
  });

  it('keeps the connection when the project read fails', async () => {
    const mcp = buildServer({
      client: testClient(async (path) => {
        if (path.startsWith('orgs/1/connected_orgs/')) {
          return [connection(11, 894)];
        }
        if (path === 'orgs/1/projects/1001/') {
          throw new OpenSolarApiError('nope', 404, '');
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
      session.callTool({
        name: 'preflight_project_share',
        arguments: { project_id: 1001, target_org_id: 894 },
      }),
    );
    const payload = requireStructuredContent(result) as {
      connection: { status: string };
      project_share: { status: string; gap?: string };
      resources: Array<{ share: string }>;
    };
    expect(payload.connection.status).toBe('active');
    expect(payload.project_share).toEqual({
      status: 'unknown',
      gap: 'The record was not found',
    });
    expect(payload.resources.every((row) => row.share === 'unknown')).toBe(true);
  });
});
