import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

function connection(
  id: number,
  partnerOrgId: number,
  flags: {
    is_active?: boolean;
    is_other_active?: boolean;
    is_other_enabled?: boolean;
  } = {},
) {
  return {
    id,
    org_name: 'Partner',
    org_to: `https://api.opensolar.com/api/orgs/${partnerOrgId}/`,
    is_active: flags.is_active ?? true,
    is_other_active: flags.is_other_active ?? true,
    is_other_enabled: flags.is_other_enabled ?? true,
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
  it('reports a ready connection and confirms referenced entities that the filtered list returns', async () => {
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
        if (path.startsWith('orgs/1/payment_options/')) {
          return [{ id: 7, title: 'Cash' }];
        }
        if (path.startsWith('orgs/1/pricing_schemes/')) {
          return [{ id: 1408, title: 'Standard' }];
        }
        if (path.startsWith('orgs/1/component_module_activations/')) {
          return [{ id: 613, code: 'JKM285M-60' }];
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
    expect(paths.some((path) => path.includes('component_inverter_activations'))).toBe(false);
    expect(paths.some((path) => path.startsWith('orgs/1/costings/'))).toBe(false);
    expect(paths).toContain(
      'orgs/1/payment_options/?fieldset=list&shared_with=894&page=1&limit=100',
    );
    expect(payload.connection).toMatchObject({
      status: 'ready',
      connection_id: 11,
      is_active: true,
      is_other_active: true,
      is_other_enabled: true,
    });
    expect(payload.project_share.status).toBe('shared');
    expect(resource(payload, 'payment_option')).toMatchObject({
      referenced: 'yes',
      ids: [7],
      shared_ids: [7],
      missing_share_ids: [],
      share: 'shared',
    });
    expect(resource(payload, 'pricing_scheme')).toMatchObject({
      referenced: 'yes',
      ids: [1408],
      shared_ids: [1408],
      missing_share_ids: [],
      share: 'shared',
    });
    expect(resource(payload, 'costing')).toMatchObject({ referenced: 'no', share: 'unknown' });
    expect(resource(payload, 'costing')).not.toHaveProperty('shared_ids');
    expect(resource(payload, 'component_module_activation')).toMatchObject({
      referenced: 'yes',
      ids: [613],
      shared_ids: [613],
      missing_share_ids: [],
      share: 'shared',
    });
    expect(resource(payload, 'component_inverter_activation')).toMatchObject({
      referenced: 'unknown',
      share: 'unknown',
    });
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
          return [connection(11, 894), connection(12, 894, { is_active: false })];
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
    expect(payload.connection.status).toBe('ready');
    expect(payload.project_share).toEqual({
      status: 'unknown',
      gap: 'The record was not found',
    });
    expect(payload.resources.every((row) => row.share === 'unknown')).toBe(true);
  });

  it('marks a referenced payment option not shared after a finished filtered scan', async () => {
    const payload = await sharePreflight(async (path) => {
      if (path.startsWith('orgs/1/connected_orgs/')) {
        return [connection(11, 894)];
      }
      if (path === 'orgs/1/projects/1001/') {
        return { id: 1001, shared_with: [], payment_option_sold: 7 };
      }
      if (path.startsWith('orgs/1/systems/')) {
        return [];
      }
      if (path.startsWith('orgs/1/payment_options/')) {
        return [{ id: 8, title: 'Other' }];
      }
      throw new Error(`unexpected read ${path}`);
    });
    expect(resource(payload, 'payment_option')).toEqual({
      resource: 'payment_option',
      referenced: 'yes',
      ids: [7],
      shared_ids: [],
      missing_share_ids: [7],
      share: 'not_shared',
    });
  });

  it('splits module activations that are only partly in the filtered list', async () => {
    const payload = await sharePreflight(async (path) => {
      if (path.startsWith('orgs/1/connected_orgs/')) {
        return [connection(11, 894)];
      }
      if (path === 'orgs/1/projects/1001/') {
        return { id: 1001, shared_with: [], payment_option_sold: null, costing: null };
      }
      if (path.startsWith('orgs/1/systems/')) {
        return [
          {
            id: 1253,
            modules: [{ module_activation_id: 613 }, { module_activation_id: 614 }],
          },
        ];
      }
      if (path.startsWith('orgs/1/component_module_activations/')) {
        return [{ id: 613 }];
      }
      throw new Error(`unexpected read ${path}`);
    });
    expect(resource(payload, 'component_module_activation')).toMatchObject({
      referenced: 'yes',
      ids: [613, 614],
      shared_ids: [613],
      missing_share_ids: [614],
      share: 'partially_shared',
    });
  });

  it('does not call page-one resources fully shared when the systems reference set is incomplete', async () => {
    const calls: string[] = [];
    const systems = Array.from({ length: 100 }, (_, index) => ({
      id: 1000 + index,
      pricing_scheme: 'https://api.opensolar.com/api/orgs/1/pricing_schemes/1408/',
      modules: [{ module_activation_id: 613 }],
    }));
    const payload = await sharePreflight(async (path) => {
      calls.push(path);
      if (path.startsWith('orgs/1/connected_orgs/')) {
        return [connection(11, 894)];
      }
      if (path === 'orgs/1/projects/1001/') {
        return {
          id: 1001,
          shared_with: [],
          payment_option_sold: null,
          costing: null,
          costing_override: null,
        };
      }
      if (path.startsWith('orgs/1/systems/')) {
        return systems;
      }
      throw new Error(`unexpected read ${path}`);
    });

    expect(resource(payload, 'pricing_scheme')).toMatchObject({
      referenced: 'yes',
      ids: [1408],
      share: 'unknown',
      gap: 'Systems list is incomplete; additional referenced resources may exist.',
    });
    expect(resource(payload, 'component_module_activation')).toMatchObject({
      referenced: 'yes',
      ids: [613],
      share: 'unknown',
      gap: 'Systems list is incomplete; additional referenced resources may exist.',
    });
    expect(calls.some((path) => path.startsWith('orgs/1/pricing_schemes/'))).toBe(false);
    expect(calls.some((path) => path.startsWith('orgs/1/component_module_activations/'))).toBe(false);
  });

  it('does not treat a missing id on an unfinished filtered scan as not shared', async () => {
    const calls: string[] = [];
    const page = Array.from({ length: 100 }, (_, index) => ({ id: 2000 + index }));
    const payload = await sharePreflight(async (path) => {
      calls.push(path);
      if (path.startsWith('orgs/1/connected_orgs/')) {
        return [connection(11, 894)];
      }
      if (path === 'orgs/1/projects/1001/') {
        return { id: 1001, shared_with: [], payment_option_sold: 7 };
      }
      if (path.startsWith('orgs/1/systems/')) {
        return [];
      }
      if (path.startsWith('orgs/1/payment_options/')) {
        return page;
      }
      throw new Error(`unexpected read ${path}`);
    });
    expect(calls.filter((path) => path.startsWith('orgs/1/payment_options/'))).toHaveLength(3);
    const row = resource(payload, 'payment_option');
    expect(row.share).toBe('unknown');
    expect(row).not.toHaveProperty('missing_share_ids');
    expect(row.shared_ids).toEqual([]);
  });

  it('keeps a locally enabled connection not ready until the partner has accepted and enabled it', async () => {
    const unaccepted = await sharePreflight(async (path) =>
      readyShell(path, { is_other_active: false }),
    );
    expect(unaccepted.connection).toMatchObject({
      status: 'not_ready',
      is_active: true,
      is_other_active: false,
      is_other_enabled: true,
    });

    const partnerDisabled = await sharePreflight(async (path) =>
      readyShell(path, { is_other_enabled: false }),
    );
    expect(partnerDisabled.connection).toMatchObject({
      status: 'not_ready',
      is_active: true,
      is_other_active: true,
      is_other_enabled: false,
    });

    const ready = await sharePreflight(async (path) => readyShell(path, {}));
    expect(ready.connection).toMatchObject({
      status: 'ready',
      is_active: true,
      is_other_active: true,
      is_other_enabled: true,
    });
  });
});

async function sharePreflight(get: (path: string) => Promise<unknown>) {
  const mcp = buildServer({
    client: testClient(get),
    orgId: 1,
    filters: ALL_TOOL_FILTERS,
  });
  const result = await withMcpClient(mcp, (session) =>
    session.callTool({
      name: 'preflight_project_share',
      arguments: { project_id: 1001, target_org_id: 894 },
    }),
  );
  return requireStructuredContent(result) as {
    connection: Record<string, unknown>;
    resources: Array<Record<string, unknown>>;
  };
}

function readyShell(
  path: string,
  flags: { is_other_active?: boolean; is_other_enabled?: boolean },
) {
  if (path.startsWith('orgs/1/connected_orgs/')) {
    return [connection(11, 894, flags)];
  }
  if (path === 'orgs/1/projects/1001/') {
    return { id: 1001, shared_with: [], payment_option_sold: null };
  }
  if (path.startsWith('orgs/1/systems/')) {
    return [];
  }
  throw new Error(`unexpected read ${path}`);
}
