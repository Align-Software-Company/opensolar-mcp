import { describe, expect, it } from 'vitest';
import { TEAM_PERMISSION_KEYS } from '../../src/lib/enums/team-permissions.js';
import { DeletedRecordSchema } from '../../src/schemas/project.js';
import {
  AcceptConnectionRequestOutputSchema,
  ConnectedOrgListSchema,
  ConnectedOrgSchema,
  ConnectionRequestListSchema,
  PermissionRoleSchema,
  ShareEntitiesOutputSchema,
  ShareProjectOutputSchema,
} from '../../src/schemas/team.js';
import { buildServer } from '../../src/server.js';
import {
  ALL_TOOL_FILTERS,
  requireStructuredContent,
  testClient,
  withMcpClient,
} from '../helpers/mcp.js';

const connectionRecord = {
  id: 123,
  url: 'https://api.opensolar.com/api/orgs/1/connected_orgs/123/',
  org: 'https://api.opensolar.com/api/orgs/1/',
  org_to: 'https://api.opensolar.com/api/orgs/894/',
  org_name: 'Partner Org',
  permission: 'https://api.opensolar.com/api/orgs/1/permissions_role/44/',
  notify_roles: [7],
  is_active: true,
  is_other_active: false,
  is_other_enabled: false,
  secret: 'SECRET-SHOULD-NOT-LEAK',
};

const curatedConnection = {
  id: 123,
  org_name: 'Partner Org',
  partner_org_id: 894,
  permission_role_id: 44,
  notify_roles: [7],
  is_active: true,
  is_other_active: false,
  is_other_enabled: false,
};

function permissionFlags(value: 0 | 1) {
  return { view: value, create: value, edit: value, delete: value };
}

function permissions(overrides: Record<string, 0 | 1> = {}) {
  const project = Object.fromEntries(
    TEAM_PERMISSION_KEYS.map((key) => [key, permissionFlags(overrides[key] ?? 0)]),
  );
  return { project };
}

describe('list_connected_orgs', () => {
  it('sends fieldset, page, and limit, and returns ids instead of URLs', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return [connectionRecord];
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'list_connected_orgs', arguments: {} }),
    );
    const payload = ConnectedOrgListSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/connected_orgs/?fieldset=list&page=1&limit=20']);
    expect(payload).toEqual({ connected_orgs: [curatedConnection], page: 1, limit: 20 });
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
    expect(JSON.stringify(result)).not.toContain('https://');
  });
});

describe('list_connection_requests', () => {
  it('returns the pending request fields', async () => {
    const calls: string[] = [];
    const client = testClient(async (path) => {
      calls.push(path);
      return [
        {
          item_id: 81,
          org_from_id: 2,
          org_from_name: 'Partner Org',
          org_to_id: 1,
          note: 'SECRET-SHOULD-NOT-LEAK',
        },
      ];
    });
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'list_connection_requests', arguments: {} }),
    );
    const payload = ConnectionRequestListSchema.parse(requireStructuredContent(result));

    expect(calls).toEqual(['orgs/1/connected_orgs/pending/']);
    expect(payload.connection_requests).toEqual([
      { item_id: 81, org_from_id: 2, org_from_name: 'Partner Org', org_to_id: 1 },
    ]);
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });
});

describe('create_connection_request', () => {
  it('posts org_name and builds the permission URL from the role id', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return connectionRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_connection_request',
        arguments: {
          org_name: 'Partner Org',
          notify_roles: [7],
          is_active: true,
          permission_role_id: 44,
        },
      }),
    );
    const payload = ConnectedOrgSchema.parse(requireStructuredContent(result));

    expect(posts).toEqual([
      {
        path: 'orgs/1/connected_orgs/',
        body: {
          org_name: 'Partner Org',
          notify_roles: [7],
          is_active: true,
          permission: 'https://api.opensolar.com/api/orgs/1/permissions_role/44/',
        },
      },
    ]);
    expect(payload).toEqual(curatedConnection);
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });

  it('omits optional fields that were not set', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return { ...connectionRecord, permission: null, notify_roles: [] };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_connection_request',
        arguments: { org_name: 'Partner Org', notify_roles: [7] },
      }),
    );

    expect(posts[0]?.body).toEqual({ org_name: 'Partner Org', notify_roles: [7] });
  });

  it('requires notify_roles because OpenSolar does not list it as optional', async () => {
    const posts: unknown[] = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (_path, body) => {
      posts.push(body);
      return connectionRecord;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_connection_request',
        arguments: { org_name: 'Partner Org' },
      }),
    );

    expect(result.isError).toBe(true);
    expect(posts).toEqual([]);
  });
});

describe('accept_connection_request', () => {
  it('posts org_to_id and does not return the upstream body', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return { secret: 'SECRET-SHOULD-NOT-LEAK' };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'accept_connection_request',
        arguments: { org_to_id: 2 },
      }),
    );
    const payload = AcceptConnectionRequestOutputSchema.parse(requireStructuredContent(result));

    expect(posts).toEqual([
      { path: 'orgs/1/connected_orgs/accept_connection/', body: { org_to_id: 2 } },
    ]);
    expect(payload).toEqual({ org_to_id: 2 });
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });
});

describe('update_connection', () => {
  it('patches is_active', async () => {
    const patches: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.patch = async (path, body) => {
      patches.push({ path, body });
      return { ...connectionRecord, is_active: false };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'update_connection',
        arguments: { id: 123, is_active: false },
      }),
    );
    const payload = ConnectedOrgSchema.parse(requireStructuredContent(result));

    expect(patches).toEqual([{ path: 'orgs/1/connected_orgs/123/', body: { is_active: false } }]);
    expect(payload.is_active).toBe(false);
  });
});

describe('delete_connection', () => {
  it('deletes the connection and returns id and deleted', async () => {
    const deletes: string[] = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.delete = async (path) => {
      deletes.push(path);
      return { secret: 'SECRET-SHOULD-NOT-LEAK' };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({ name: 'delete_connection', arguments: { id: 123 } }),
    );
    const payload = DeletedRecordSchema.parse(requireStructuredContent(result));

    expect(deletes).toEqual(['orgs/1/connected_orgs/123/']);
    expect(payload).toEqual({ id: 123, deleted: true });
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });
});

describe('share_project', () => {
  it('puts one shared_with entry and builds the permission URL', async () => {
    const puts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.put = async (path, body) => {
      puts.push({ path, body });
      return { address: 'SECRET-SHOULD-NOT-LEAK' };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'share_project',
        arguments: {
          project_id: 9,
          org_id: 894,
          permission_role_id: 44,
          is_shared: false,
        },
      }),
    );
    const payload = ShareProjectOutputSchema.parse(requireStructuredContent(result));

    expect(puts).toEqual([
      {
        path: 'orgs/1/projects/9/',
        body: {
          shared_with: [
            {
              org_id: 894,
              permission: 'https://api.opensolar.com/api/orgs/1/permissions_role/44/',
              is_shared: false,
            },
          ],
        },
      },
    ]);
    expect(payload).toEqual({
      project_id: 9,
      org_id: 894,
      permission_role_id: 44,
      is_shared: false,
    });
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });

  it('omits is_shared when the caller does not set it', async () => {
    const puts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.put = async (path, body) => {
      puts.push({ path, body });
      return null;
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'share_project',
        arguments: { project_id: 9, org_id: 894, permission_role_id: 44 },
      }),
    );
    const payload = ShareProjectOutputSchema.parse(requireStructuredContent(result));
    const body = puts[0]?.body as { shared_with: Array<Record<string, unknown>> };

    expect(body.shared_with[0]).not.toHaveProperty('is_shared');
    expect(payload.is_shared).toBe(true);
  });
});

describe('share_entities', () => {
  it('sends resource as the same value as entity_type', async () => {
    const puts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.put = async (path, body) => {
      puts.push({ path, body });
      return { secret: 'SECRET-SHOULD-NOT-LEAK' };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'share_entities',
        arguments: {
          entity_type: 'adders',
          ids: [19],
          share_with_ids: [894],
        },
      }),
    );
    const payload = ShareEntitiesOutputSchema.parse(requireStructuredContent(result));

    expect(puts).toEqual([
      {
        path: 'orgs/1/bulk/adders/',
        body: {
          share_with_ids: [894],
          unshare_with_ids: [],
          resource: 'adders',
          ids: [19],
        },
      },
    ]);
    expect(payload.entity_type).toBe('adders');
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });

  it('rejects an entity type that is not on the page', async () => {
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.put = async () => {
      throw new Error('should not call OpenSolar');
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'share_entities',
        arguments: { entity_type: 'projects', ids: [19], share_with_ids: [894] },
      }),
    );

    expect(result.isError).toBe(true);
  });
});

describe('create_permission_role', () => {
  it('posts role_type 1 and the permission flags as a JSON string', async () => {
    const posts: Array<{ path: string; body: unknown }> = [];
    const client = testClient(async () => {
      throw new Error('unexpected OpenSolar read');
    });
    client.post = async (path, body) => {
      posts.push({ path, body });
      return { id: 55, title: 'Partner view', permissions: 'SECRET-SHOULD-NOT-LEAK' };
    };
    const mcp = buildServer({ client, orgId: 1, filters: ALL_TOOL_FILTERS });
    const flags = permissions({ project: 1 });

    const result = await withMcpClient(mcp, (session) =>
      session.callTool({
        name: 'create_permission_role',
        arguments: { title: 'Partner view', permissions: flags },
      }),
    );
    const payload = PermissionRoleSchema.parse(requireStructuredContent(result));

    expect(posts).toEqual([
      {
        path: 'orgs/1/permissions_role/',
        body: {
          role_type: 1,
          title: 'Partner view',
          permissions: JSON.stringify(flags),
        },
      },
    ]);
    expect(payload).toEqual({ id: 55, title: 'Partner view' });
    expect(JSON.stringify(result)).not.toContain('SECRET-SHOULD-NOT-LEAK');
  });
});
