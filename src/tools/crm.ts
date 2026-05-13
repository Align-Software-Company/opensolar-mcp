import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenSolarClient } from '../client/index.js';
import { DEFAULT_REDACTION, redactSensitive } from '../lib/redaction.js';
import { type Contact, ContactListSchema, ContactSchema } from '../schemas/contact.js';

export interface CrmContext {
  client: OpenSolarClient;
  orgId: number;
}

const syntheticEmailPattern = /^\d+@os\.code$/;

function enrichContact(contact: Contact): Contact & { is_synthetic_email: boolean } {
  const redacted = redactSensitive(contact, DEFAULT_REDACTION) as Contact;
  const emailValue = typeof redacted.email === 'string' ? redacted.email : null;
  const isSyntheticEmail = emailValue !== null && syntheticEmailPattern.test(emailValue);

  const { url: _url, share_urls: _shareUrls, ...withoutNoise } = redacted;
  const withDerivedField: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(withoutNoise)) {
    withDerivedField[key] = value;
    if (key === 'email') {
      withDerivedField.is_synthetic_email = isSyntheticEmail;
    }
  }

  if (!Object.hasOwn(withDerivedField, 'is_synthetic_email')) {
    withDerivedField.is_synthetic_email = isSyntheticEmail;
  }

  return withDerivedField as Contact & { is_synthetic_email: boolean };
}

const listContactsInputShape = {
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
};

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

const getContactInputShape = {
  contact_id: z
    .number()
    .int()
    .positive()
    .describe(
      'OpenSolar contact ID. Get this from `list_contacts` results or another tool that ' +
        'surfaces contact IDs.',
    ),
};

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

export function registerCrmToolset(server: McpServer, ctx: CrmContext): void {
  server.registerTool(
    'list_contacts',
    {
      description: listContactsDescription,
      inputSchema: listContactsInputShape,
    },
    async ({ page, limit, ordering }) => {
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
    },
  );

  server.registerTool(
    'get_contact',
    {
      description: getContactDescription,
      inputSchema: getContactInputShape,
    },
    async ({ contact_id }) => {
      const path = `orgs/${ctx.orgId}/contacts/${contact_id}/`;
      const raw = await ctx.client.get(path);
      const contact = ContactSchema.parse(raw);
      const payload = enrichContact(contact);

      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}
