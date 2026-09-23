import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { DEFAULT_REDACTION, redactSensitive } from '../lib/redaction.js';
import type { ToolName } from '../lib/tier-policy.js';
import { curateOrg, GetOrgOutputSchema, OrgSchema } from '../schemas/org.js';
import {
  CuratedRoleSchema,
  curateRole,
  ListRolesOutputSchema,
  RoleListSchema,
  RoleSchema,
} from '../schemas/role.js';

export interface OrgContext {
  client: OpenSolarClient;
  orgId: number;
}

const getOrgInputSchema = z.object({
  verbose: z
    .boolean()
    .default(false)
    .describe(
      'When true, returns the full org object with sensitive fields redacted. ' +
        'Default false returns the curated subset.',
    ),
});

export function registerOrgToolset(
  server: McpServer,
  ctx: OrgContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('get_org')) {
    registerGetOrg(server, ctx);
  }
  if (enabled.has('list_roles')) {
    registerListRoles(server, ctx);
  }
  if (enabled.has('get_role')) {
    registerGetRole(server, ctx);
  }
}

function registerGetOrg(server: McpServer, ctx: OrgContext): void {
  server.registerTool(
    'get_org',
    {
      title: 'Get organization',
      description:
        'Returns the connected OpenSolar org: id, name, address, contact info, and measurement units. ' +
        '`verbose: true` returns the full redacted payload.',
      inputSchema: getOrgInputSchema,
      outputSchema: GetOrgOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ verbose }) =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/`;
        const raw = await ctx.client.get(path);
        const org = OrgSchema.parse(raw);
        if (verbose) {
          const payload = redactSensitive(org, DEFAULT_REDACTION);
          return openSolarSuccess(payload, `Full redacted org ${org.id}.`);
        }
        const payload = curateOrg(org);
        const name = payload.name === null || payload.name === undefined ? '' : payload.name;
        const summary = name === '' ? `Org ${payload.id}.` : `Org ${payload.id}: ${name}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}

function registerListRoles(server: McpServer, ctx: OrgContext): void {
  server.registerTool(
    'list_roles',
    {
      title: 'List roles',
      description:
        'Lists roles in the connected org as `{ roles }`: id, display, email, phone, job title, and is_admin. Chat API keys are omitted.',
      inputSchema: z.object({}),
      outputSchema: ListRolesOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () =>
      runOpenSolarTool(async () => {
        const path = `orgs/${ctx.orgId}/roles/`;
        const raw = await ctx.client.get(path);
        const redacted = redactSensitive(RoleListSchema.parse(raw), DEFAULT_REDACTION);
        const payload = ListRolesOutputSchema.parse({ roles: redacted.map(curateRole) });
        return openSolarSuccess(payload, `${payload.roles.length} roles.`);
      }),
  );
}

function registerGetRole(server: McpServer, ctx: OrgContext): void {
  server.registerTool(
    'get_role',
    {
      title: 'Get role',
      description:
        'Returns one role by id: display, email, phone, job title, and is_admin. Chat API keys are omitted. ' +
        'Optional fieldset is list only.',
      inputSchema: z.object({
        id: z.number().int().positive().describe('Role id. Use list_roles to discover ids.'),
        fieldset: z
          .literal('list')
          .optional()
          .describe('When set, the request uses fieldset=list. No other fieldset is accepted.'),
      }),
      outputSchema: CuratedRoleSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id, fieldset }) =>
      runOpenSolarTool(async () => {
        const query = fieldset === undefined ? '' : '?fieldset=list';
        const path = `orgs/${ctx.orgId}/roles/${id}/${query}`;
        const raw = await ctx.client.get(path);
        const redacted = redactSensitive(RoleSchema.parse(raw), DEFAULT_REDACTION);
        const payload = CuratedRoleSchema.parse(curateRole(redacted));
        const display = payload.display ?? '';
        const summary = display === '' ? `Role ${id}.` : `Role ${id}: ${display}.`;
        return openSolarSuccess(payload, summary);
      }),
  );
}
