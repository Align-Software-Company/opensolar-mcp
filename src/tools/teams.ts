import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { SHARE_ENTITY_TYPES } from '../lib/enums/share-entities.js';
import { TEAM_PERMISSION_KEYS } from '../lib/enums/team-permissions.js';
import { loadProjectSharePreflight } from '../lib/preflight-project-share.js';
import type { ToolName } from '../lib/tier-policy.js';
import { DeletedRecordSchema } from '../schemas/project.js';
import { PreflightProjectShareSchema } from '../schemas/project-share-preflight.js';
import {
  AcceptConnectionRequestOutputSchema,
  type ConnectedOrg,
  ConnectedOrgListSchema,
  ConnectedOrgSchema,
  type ConnectionRequest,
  ConnectionRequestListSchema,
  PermissionRoleSchema,
  ShareEntitiesOutputSchema,
  ShareProjectOutputSchema,
} from '../schemas/team.js';

export interface TeamsContext {
  client: OpenSolarClient;
  orgId: number;
}

const CONNECTED_ORG_LIMIT =
  'Connected-org calls are limited to 100 a day per user and per org. This server does not count them.';
// OpenSolar's throttle page lists only create, update, and list for connected orgs.
const UNLISTED_CONNECTED_ORG_LIMIT =
  'OpenSolar does not publish a quota for this call; treat it like the 100-a-day connected-org limit. This server does not count calls.';

const PARTNER_ORG_ID = /\/orgs\/(\d+)\/?$/;
const PERMISSION_ROLE_ID = /\/permissions_role\/(\d+)\/?/;

const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;

const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

const updateAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const positiveId = z.number().int().positive();
const flag = z.union([z.literal(0), z.literal(1)]);

const permissionActions = z
  .object({
    view: flag,
    create: flag,
    edit: flag,
    delete: flag,
  })
  .strict();

const projectPermissionShape = Object.fromEntries(
  TEAM_PERMISSION_KEYS.map((key) => [key, permissionActions]),
) as Record<(typeof TEAM_PERMISSION_KEYS)[number], typeof permissionActions>;

const pageLimitFields = {
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum rows per page. Defaults to 20, capped at 100.'),
};

const listConnectedOrgsInput = z.object(pageLimitFields);

const createConnectionInput = z
  .object({
    org_name: z.string().min(1).describe('Partner org name. Must match exactly.'),
    notify_roles: z
      .array(positiveId)
      .describe(
        'Role ids in this org to notify when the partner shares a project. OpenSolar lists this field as required.',
      ),
    is_active: z.boolean().optional().describe('When false, the connection is created disabled.'),
    permission_role_id: positiveId
      .optional()
      .describe('Default permission role. The server builds the role URL.'),
  })
  .strict();

const acceptConnectionInput = z
  .object({
    org_to_id: positiveId.describe('org_to_id from list_connection_requests.'),
  })
  .strict();

const updateConnectionInput = z
  .object({
    id: positiveId.describe('Connection id from list_connected_orgs.'),
    is_active: z.boolean().describe('false disables sharing both ways. true enables it again.'),
  })
  .strict();

const connectionIdInput = z
  .object({
    id: positiveId.describe('Connection id from list_connected_orgs.'),
  })
  .strict();

const shareProjectInput = z
  .object({
    project_id: positiveId,
    org_id: positiveId.describe('Connected org to share with.'),
    permission_role_id: positiveId.describe('Permission role. The server builds the role URL.'),
    is_shared: z
      .boolean()
      .optional()
      .describe('Whether the project is visible to that org. Defaults to true when omitted.'),
  })
  .strict();

const shareEntitiesInput = z
  .object({
    entity_type: z.enum(SHARE_ENTITY_TYPES).describe('Also sent as resource.'),
    ids: z.array(positiveId).min(1).describe('Entity ids to share or unshare.'),
    share_with_ids: z.array(positiveId).default([]),
    unshare_with_ids: z.array(positiveId).default([]),
  })
  .strict()
  .refine((input) => input.share_with_ids.length > 0 || input.unshare_with_ids.length > 0, {
    message: 'At least one org id is required',
  });

const createPermissionRoleInput = z
  .object({
    title: z.string().min(1),
    permissions: z
      .object({
        project: z.object(projectPermissionShape).strict(),
      })
      .strict()
      .describe('Each action is 0 or 1. These flags only reduce what a partner can do.'),
  })
  .strict();

function toolError(text: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text }],
  };
}

function idFromPath(value: unknown, pattern: RegExp): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = pattern.exec(value);
  if (!match?.[1]) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function roleIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is number => Number.isInteger(item) && item > 0);
}

function flagValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

function connectedOrg(value: unknown): ConnectedOrg | null {
  const record = asRecord(value);
  if (!record || !Number.isInteger(record.id) || Number(record.id) <= 0) {
    return null;
  }
  return {
    id: Number(record.id),
    org_name: text(record.org_name),
    partner_org_id: idFromPath(record.org_to, PARTNER_ORG_ID),
    permission_role_id: idFromPath(record.permission, PERMISSION_ROLE_ID),
    notify_roles: roleIds(record.notify_roles),
    is_active: flagValue(record.is_active),
    is_other_active: flagValue(record.is_other_active),
    is_other_enabled: flagValue(record.is_other_enabled),
  };
}

function connectionRequest(value: unknown): ConnectionRequest | null {
  const record = asRecord(value);
  if (
    !record ||
    !Number.isInteger(record.item_id) ||
    Number(record.item_id) <= 0 ||
    !Number.isInteger(record.org_from_id) ||
    Number(record.org_from_id) <= 0 ||
    !Number.isInteger(record.org_to_id) ||
    Number(record.org_to_id) <= 0
  ) {
    return null;
  }
  return {
    item_id: Number(record.item_id),
    org_from_id: Number(record.org_from_id),
    org_from_name: text(record.org_from_name),
    org_to_id: Number(record.org_to_id),
  };
}

function permissionRoleUrl(
  client: OpenSolarClient,
  orgId: number,
  permissionRoleId: number,
): string {
  return client.resourceUrl(`orgs/${orgId}/permissions_role/${permissionRoleId}/`);
}

export function registerTeamsToolset(
  server: McpServer,
  ctx: TeamsContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_connected_orgs')) {
    registerListConnectedOrgs(server, ctx);
  }
  if (enabled.has('preflight_project_share')) {
    registerPreflightProjectShare(server, ctx);
  }
  if (enabled.has('list_connection_requests')) {
    registerListConnectionRequests(server, ctx);
  }
  if (enabled.has('create_connection_request')) {
    registerCreateConnectionRequest(server, ctx);
  }
  if (enabled.has('accept_connection_request')) {
    registerAcceptConnectionRequest(server, ctx);
  }
  if (enabled.has('update_connection')) {
    registerUpdateConnection(server, ctx);
  }
  if (enabled.has('delete_connection')) {
    registerDeleteConnection(server, ctx);
  }
  if (enabled.has('share_project')) {
    registerShareProject(server, ctx);
  }
  if (enabled.has('share_entities')) {
    registerShareEntities(server, ctx);
  }
  if (enabled.has('create_permission_role')) {
    registerCreatePermissionRole(server, ctx);
  }
}

function registerListConnectedOrgs(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'list_connected_orgs',
    {
      title: 'List connected orgs',
      description: `Lists established org connections. ${CONNECTED_ORG_LIMIT}`,
      inputSchema: listConnectedOrgsInput,
      outputSchema: ConnectedOrgListSchema,
      annotations: readAnnotations,
    },
    async ({ page, limit }) =>
      runOpenSolarTool(async () => {
        const query = new URLSearchParams({
          fieldset: 'list',
          page: String(page),
          limit: String(limit),
        });
        const body = await ctx.client.get(`orgs/${ctx.orgId}/connected_orgs/?${query.toString()}`);
        if (!Array.isArray(body)) {
          return toolError('Connected org list was not an array.');
        }
        const connectedOrgs: ConnectedOrg[] = [];
        for (const item of body) {
          const record = connectedOrg(item);
          if (!record) {
            return toolError('Connected org list included a record without an id.');
          }
          connectedOrgs.push(record);
        }
        const output = ConnectedOrgListSchema.parse({
          connected_orgs: connectedOrgs,
          page,
          limit,
        });
        return openSolarSuccess(
          output,
          `Connected orgs: ${output.connected_orgs.length} (page ${page}, limit ${limit}).`,
        );
      }),
  );
}

function registerPreflightProjectShare(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'preflight_project_share',
    {
      title: 'Preflight project share',
      description:
        'Checks whether a project can be shared with a connected org. This does not share the project or any entity. ' +
        'connection is ready only when one completed list match has is_active, is_other_active, and is_other_enabled all true. A false flag is not_ready. ' +
        'project_share comes from shared_with on the project. ' +
        'Payment options, pricing schemes, costings, and module activations are read with fieldset=list and shared_with set to the target org. ' +
        'shared means every referenced id was in that filtered list. not_shared means a finished filtered scan omitted them. partially_shared lists both. ' +
        'An unfinished filtered scan is unknown and does not treat a missing id as not_shared. ' +
        'Inverter, battery, and other activation ids stay unknown because the systems list example does not name those keys.',
      inputSchema: z
        .object({
          project_id: positiveId.describe('Project id from list_projects or search_projects.'),
          target_org_id: positiveId.describe('Partner org id, not the connection id.'),
        })
        .strict(),
      outputSchema: PreflightProjectShareSchema,
      annotations: readAnnotations,
    },
    async ({ project_id, target_org_id }) =>
      runOpenSolarTool(async () => {
        const payload = PreflightProjectShareSchema.parse(
          await loadProjectSharePreflight(ctx.client, ctx.orgId, project_id, target_org_id),
        );
        return openSolarSuccess(
          payload,
          `Share preflight for project ${project_id} and org ${target_org_id}: connection ${payload.connection.status}, project ${payload.project_share.status}.`,
        );
      }),
  );
}

function registerListConnectionRequests(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'list_connection_requests',
    {
      title: 'List connection requests',
      description: `Lists pending connection requests. ${UNLISTED_CONNECTED_ORG_LIMIT}`,
      inputSchema: z.object({}).strict(),
      outputSchema: ConnectionRequestListSchema,
      annotations: readAnnotations,
    },
    async () =>
      runOpenSolarTool(async () => {
        const body = await ctx.client.get(`orgs/${ctx.orgId}/connected_orgs/pending/`);
        if (!Array.isArray(body)) {
          return toolError('Connection request list was not an array.');
        }
        const connectionRequests: ConnectionRequest[] = [];
        for (const item of body) {
          const record = connectionRequest(item);
          if (!record) {
            return toolError('Connection request list included a record without an id.');
          }
          connectionRequests.push(record);
        }
        const output = ConnectionRequestListSchema.parse({
          connection_requests: connectionRequests,
        });
        return openSolarSuccess(
          output,
          `Pending connection requests: ${output.connection_requests.length}.`,
        );
      }),
  );
}

function registerCreateConnectionRequest(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'create_connection_request',
    {
      title: 'Create connection request',
      description: `Requests a connection to a partner org. org_name must match exactly. This call is not retried. ${CONNECTED_ORG_LIMIT}`,
      inputSchema: createConnectionInput,
      outputSchema: ConnectedOrgSchema,
      annotations: createAnnotations,
    },
    async (input) =>
      runOpenSolarTool(async () => {
        const payload: Record<string, unknown> = {
          org_name: input.org_name,
          notify_roles: input.notify_roles,
        };
        if (input.is_active !== undefined) {
          payload.is_active = input.is_active;
        }
        if (input.permission_role_id !== undefined) {
          payload.permission = permissionRoleUrl(ctx.client, ctx.orgId, input.permission_role_id);
        }
        const body = await ctx.client.post(`orgs/${ctx.orgId}/connected_orgs/`, payload);
        const record = connectedOrg(body);
        if (!record) {
          return toolError('Connection response did not include an id.');
        }
        const output = ConnectedOrgSchema.parse(record);
        return openSolarSuccess(
          output,
          `Requested a connection to ${output.org_name ?? input.org_name}.`,
        );
      }),
  );
}

function registerAcceptConnectionRequest(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'accept_connection_request',
    {
      title: 'Accept connection request',
      description: `Accepts a pending connection. org_to_id comes from list_connection_requests. This call is not retried. ${UNLISTED_CONNECTED_ORG_LIMIT}`,
      inputSchema: acceptConnectionInput,
      outputSchema: AcceptConnectionRequestOutputSchema,
      annotations: createAnnotations,
    },
    async ({ org_to_id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.post(`orgs/${ctx.orgId}/connected_orgs/accept_connection/`, {
          org_to_id,
        });
        const output = AcceptConnectionRequestOutputSchema.parse({ org_to_id });
        return openSolarSuccess(output, `Accepted the connection request from org ${org_to_id}.`);
      }),
  );
}

function registerUpdateConnection(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'update_connection',
    {
      title: 'Update connection',
      description: `Sets is_active on a connection. false disables sharing both ways. true enables it again. This call is not retried. ${CONNECTED_ORG_LIMIT}`,
      inputSchema: updateConnectionInput,
      outputSchema: ConnectedOrgSchema,
      annotations: updateAnnotations,
    },
    async ({ id, is_active }) =>
      runOpenSolarTool(async () => {
        const body = await ctx.client.patch(`orgs/${ctx.orgId}/connected_orgs/${id}/`, {
          is_active,
        });
        const record = connectedOrg(body);
        if (!record) {
          return toolError('Connection response did not include an id.');
        }
        const output = ConnectedOrgSchema.parse(record);
        return openSolarSuccess(
          output,
          `${is_active ? 'Enabled' : 'Disabled'} connection ${output.id}.`,
        );
      }),
  );
}

function registerDeleteConnection(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'delete_connection',
    {
      title: 'Delete connection',
      description: `Deletes a connection and its sharing settings. This call is not retried. ${UNLISTED_CONNECTED_ORG_LIMIT}`,
      inputSchema: connectionIdInput,
      outputSchema: DeletedRecordSchema,
      annotations: deleteAnnotations,
    },
    async ({ id }) =>
      runOpenSolarTool(async () => {
        await ctx.client.delete(`orgs/${ctx.orgId}/connected_orgs/${id}/`);
        const output = DeletedRecordSchema.parse({ id, deleted: true });
        return openSolarSuccess(output, `Deleted connection ${id}.`);
      }),
  );
}

function registerShareProject(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'share_project',
    {
      title: 'Share project',
      description:
        'Shares one project with one connected org. The server builds the permission role URL from permission_role_id. is_shared defaults to true when omitted. This call is not retried.',
      inputSchema: shareProjectInput,
      outputSchema: ShareProjectOutputSchema,
      annotations: updateAnnotations,
    },
    async (input) =>
      runOpenSolarTool(async () => {
        const entry: Record<string, unknown> = {
          org_id: input.org_id,
          permission: permissionRoleUrl(ctx.client, ctx.orgId, input.permission_role_id),
        };
        if (input.is_shared !== undefined) {
          entry.is_shared = input.is_shared;
        }
        await ctx.client.put(`orgs/${ctx.orgId}/projects/${input.project_id}/`, {
          shared_with: [entry],
        });
        const output = ShareProjectOutputSchema.parse({
          project_id: input.project_id,
          org_id: input.org_id,
          permission_role_id: input.permission_role_id,
          is_shared: input.is_shared ?? true,
        });
        return openSolarSuccess(
          output,
          `Shared project ${output.project_id} with org ${output.org_id}.`,
        );
      }),
  );
}

function registerShareEntities(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'share_entities',
    {
      title: 'Share entities',
      description:
        'Shares or unshares one kind of entity with connected orgs. resource is the same value as entity_type. This call is not retried.',
      inputSchema: shareEntitiesInput,
      outputSchema: ShareEntitiesOutputSchema,
      annotations: updateAnnotations,
    },
    async (input) =>
      runOpenSolarTool(async () => {
        await ctx.client.put(`orgs/${ctx.orgId}/bulk/${input.entity_type}/`, {
          share_with_ids: input.share_with_ids,
          unshare_with_ids: input.unshare_with_ids,
          resource: input.entity_type,
          ids: input.ids,
        });
        const output = ShareEntitiesOutputSchema.parse({
          entity_type: input.entity_type,
          ids: input.ids,
          share_with_ids: input.share_with_ids,
          unshare_with_ids: input.unshare_with_ids,
        });
        return openSolarSuccess(
          output,
          `Updated sharing for ${output.ids.length} ${output.entity_type}.`,
        );
      }),
  );
}

function registerCreatePermissionRole(server: McpServer, ctx: TeamsContext): void {
  server.registerTool(
    'create_permission_role',
    {
      title: 'Create permission role',
      description:
        'Creates a team permission role. role_type is always 1, the value the page uses for a partner role. These permissions only reduce what a partner can do. This call is not retried.',
      inputSchema: createPermissionRoleInput,
      outputSchema: PermissionRoleSchema,
      annotations: createAnnotations,
    },
    async ({ title, permissions }) =>
      runOpenSolarTool(async () => {
        const body = await ctx.client.post(`orgs/${ctx.orgId}/permissions_role/`, {
          role_type: 1,
          title,
          permissions: JSON.stringify(permissions),
        });
        const record = asRecord(body);
        if (!record || !Number.isInteger(record.id) || Number(record.id) <= 0) {
          return toolError('Permission role response did not include an id.');
        }
        if (typeof record.title !== 'string') {
          return toolError('Permission role response did not include a title.');
        }
        const output = PermissionRoleSchema.parse({ id: Number(record.id), title: record.title });
        return openSolarSuccess(output, `Created permission role ${output.id}.`);
      }),
  );
}
