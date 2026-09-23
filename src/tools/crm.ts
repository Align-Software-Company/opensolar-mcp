import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { enrichContact } from '../lib/contact-enrich.js';
import type { ToolName } from '../lib/tier-policy.js';
import {
  ContactListSchema,
  ContactSchema,
  ContactWriteSchema,
  EnrichedContactSchema,
  ListContactsOutputSchema,
} from '../schemas/contact.js';
import { DeletedRecordSchema } from '../schemas/project.js';

export interface CrmContext {
  client: OpenSolarClient;
  orgId: number;
}

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

const updateContactInputSchema = ContactWriteSchema.extend({
  contact_id: z.number().int().positive().describe('Contact id from list_contacts or get_contact.'),
})
  .strict()
  .refine(
    (value) =>
      value.first_name !== undefined ||
      value.family_name !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined,
    { message: 'At least one of first_name, family_name, email, or phone is required' },
  );

function contactWriteBody(input: {
  first_name?: string;
  family_name?: string;
  email?: string;
  phone?: string;
}): Record<string, string> {
  const body: Record<string, string> = {};
  if (input.first_name !== undefined) {
    body.first_name = input.first_name;
  }
  if (input.family_name !== undefined) {
    body.family_name = input.family_name;
  }
  if (input.email !== undefined) {
    body.email = input.email;
  }
  if (input.phone !== undefined) {
    body.phone = input.phone;
  }
  return body;
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

export function registerCrmToolset(
  server: McpServer,
  ctx: CrmContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('list_contacts')) {
    server.registerTool(
      'list_contacts',
      {
        title: 'List contacts',
        description:
          'Lists one page of contacts as `{ contacts }`. Each contact includes `is_synthetic_email` for `@os.code` addresses. ' +
          'Passport, licence, and date of birth are redacted. Contacts have no created_date or modified_date.',
        inputSchema: listContactsInputSchema,
        outputSchema: ListContactsOutputSchema,
        annotations: readAnnotations,
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
          const payload = ListContactsOutputSchema.parse({
            contacts: contacts.map(enrichContact),
          });
          return openSolarSuccess(payload, `${payload.contacts.length} contacts.`);
        }),
    );
  }

  if (enabled.has('get_contact')) {
    server.registerTool(
      'get_contact',
      {
        title: 'Get contact',
        description:
          'Returns one contact by id, including `is_synthetic_email`. Passport, licence, and date of birth ' +
          'are redacted. Contacts have no created_date or modified_date.',
        inputSchema: getContactInputSchema,
        outputSchema: EnrichedContactSchema,
        annotations: readAnnotations,
      },
      async ({ contact_id }) =>
        runOpenSolarTool(async () => {
          const path = `orgs/${ctx.orgId}/contacts/${contact_id}/`;
          const raw = await ctx.client.get(path);
          const contact = ContactSchema.parse(raw);
          const payload = EnrichedContactSchema.parse(enrichContact(contact));
          return openSolarSuccess(payload, `Contact ${payload.id}.`);
        }),
    );
  }

  if (enabled.has('create_contact')) {
    server.registerTool(
      'create_contact',
      {
        title: 'Create contact',
        description:
          'Adds a person to the live org. Send only first_name, family_name, email, and phone. ' +
          'This call is not retried.',
        inputSchema: ContactWriteSchema,
        outputSchema: EnrichedContactSchema,
        annotations: createAnnotations,
      },
      async (input) =>
        runOpenSolarTool(async () => {
          const raw = await ctx.client.post(`orgs/${ctx.orgId}/contacts/`, contactWriteBody(input));
          const contact = ContactSchema.parse(raw);
          const payload = EnrichedContactSchema.parse(enrichContact(contact));
          return openSolarSuccess(payload, `Contact ${payload.id}.`);
        }),
    );
  }

  if (enabled.has('update_contact')) {
    server.registerTool(
      'update_contact',
      {
        title: 'Update contact',
        description:
          'Updates a person in the live org. Send at least one of first_name, family_name, email, and phone. ' +
          'This call is not retried.',
        inputSchema: updateContactInputSchema,
        outputSchema: EnrichedContactSchema,
        annotations: updateAnnotations,
      },
      async ({ contact_id, ...fields }) =>
        runOpenSolarTool(async () => {
          const raw = await ctx.client.put(
            `orgs/${ctx.orgId}/contacts/${contact_id}/`,
            contactWriteBody(fields),
          );
          const contact = ContactSchema.parse(raw);
          const payload = EnrichedContactSchema.parse(enrichContact(contact));
          return openSolarSuccess(payload, `Contact ${payload.id}.`);
        }),
    );
  }

  if (enabled.has('delete_contact')) {
    server.registerTool(
      'delete_contact',
      {
        title: 'Delete contact',
        description: 'Removes the person from the live org. This call is not retried.',
        inputSchema: z
          .object({
            contact_id: z
              .number()
              .int()
              .positive()
              .describe('Contact id from list_contacts or get_contact.'),
          })
          .strict(),
        outputSchema: DeletedRecordSchema,
        annotations: deleteAnnotations,
      },
      async ({ contact_id }) =>
        runOpenSolarTool(async () => {
          await ctx.client.delete(`orgs/${ctx.orgId}/contacts/${contact_id}/`);
          const payload = DeletedRecordSchema.parse({ id: contact_id, deleted: true });
          return openSolarSuccess(payload, `Contact ${contact_id} deleted.`);
        }),
    );
  }
}
