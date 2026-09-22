import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { enrichContact } from '../lib/contact-enrich.js';
import type { ToolName } from '../lib/tier-policy.js';
import { ContactListSchema, ContactSchema } from '../schemas/contact.js';

export interface CrmContext {
  client: OpenSolarClient;
  orgId: number;
}

const listContactsInputSchema = z.object({
  page: z.number().int().min(1).default(1).describe('1-indexed page number. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum contacts per page. Defaults to 20, capped at 100.'),
  ordering: z
    .string()
    .optional()
    .describe(
      'Optional ordering field. Supported fields: `first_name`, `family_name`, `email`. ' +
        'Prefix with `-` for descending order (for example `-first_name` for Z→A). ' +
        "Note: this endpoint uses `-` for descending, contrary to OpenSolar's docs.",
    ),
});

const listContactsDescription =
  'List contacts from OpenSolar for the authenticated org. Returns a JSON array of contacts at ' +
  'the requested page and limit. Default ordering is API-native (typically latest first). ' +
  'Pagination: pass `page` (1-indexed) and `limit` (max 100, default 20). Heuristic for "more ' +
  'contacts available": if the returned array length equals `limit`, more pages likely exist — ' +
  'request `page + 1`. If array length is less than `limit`, this is the last page. OpenSolar ' +
  'does not return pagination metadata, so exact-multiple totals remain an edge case. Ordering: ' +
  'pass `ordering` to sort by `first_name`, `family_name`, or `email`; prefix with `-` for ' +
  'descending (for example `-first_name` for Z→A). This descending convention is empirically ' +
  "confirmed but contradicts OpenSolar's own docs. Contact types: `type: 0` (`type_name: " +
  '"normal"`) are regular records; `type: 1` (`type_name: "proposal-share"`) are auto-generated ' +
  'when proposal-share links are opened without a MyEnergy account and may include synthetic ' +
  'emails (`<digits>@os.code`). The tool adds `is_synthetic_email` to each contact so those ' +
  'emails are not treated as deliverable. Contacts may also originate from projects shared by ' +
  'another org; `org_id` identifies record ownership. Sensitive PII (`passport_number`, ' +
  '`licence_number`, `date_of_birth`) is redacted before reaching the LLM.';

const getContactInputSchema = z.object({
  contact_id: z
    .number()
    .int()
    .positive()
    .describe(
      'OpenSolar contact ID. Get this from `list_contacts` results or another tool that ' +
        'surfaces contact IDs.',
    ),
});

const getContactDescription =
  'Fetch a single contact by ID from the authenticated org. Returns the full contact object: ' +
  'id, email, phone, first/middle/family names, display, type (0=normal, 1=proposal-share), ' +
  'type_name, projects linkage, org context, custom_data, etc. Use this when you have a ' +
  'specific contact ID and need full details, or when `list_contacts` returned a result and the ' +
  'LLM wants to inspect one contact more closely. If the contact has no real email (for example, ' +
  'a proposal-share auto-generated account), `is_synthetic_email: true` is set on the response. ' +
  'Sensitive PII fields (`passport_number`, `licence_number`, `date_of_birth`) are redacted ' +
  "before reaching the LLM. OpenSolar's contact model has no `created_date` or `modified_date`, " +
  'so creation or modification time cannot be inferred from this endpoint. Returns a single ' +
  'contact object, not an array. If the contact does not exist, an API error is raised; callers ' +
  'can use `list_contacts` to verify the ID first if needed.';

export function registerCrmToolset(
  server: McpServer,
  ctx: CrmContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_contacts')) {
    server.registerTool(
      'list_contacts',
      {
        description: listContactsDescription,
        inputSchema: listContactsInputSchema,
      },
      async ({ page, limit, ordering }) =>
        runOpenSolarTool(async () => {
          const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
          });
          if (ordering !== undefined) {
            params.set('ordering', ordering);
          }

          const path = `orgs/${ctx.orgId}/contacts/?${params.toString()}`;
          const raw = await ctx.client.get(path);
          const contacts = ContactListSchema.parse(raw);
          const payload = contacts.map(enrichContact);

          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          };
        }),
    );
  }

  if (enabled.has('get_contact')) {
    server.registerTool(
      'get_contact',
      {
        description: getContactDescription,
        inputSchema: getContactInputSchema,
      },
      async ({ contact_id }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/contacts/${contact_id}/`;
          const raw = await ctx.client.get(path);
          const contact = ContactSchema.parse(raw);
          const payload = enrichContact(contact);

          return {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          };
        }),
    );
  }
}
