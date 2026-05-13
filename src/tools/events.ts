import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenSolarClient } from '../client/index.js';
import { enrichContact } from '../lib/contact-enrich.js';
import { getEventTypeName } from '../lib/enums/event-types.js';
import { type Contact, ContactSchema } from '../schemas/contact.js';
import { EventSchema } from '../schemas/event.js';

export interface EventsContext {
  client: OpenSolarClient;
  orgId: number;
}

const getEventInputShape = {
  event_id: z
    .number()
    .int()
    .positive()
    .describe(
      "OpenSolar event ID. Get this from get_project's events_data, or from another tool that " +
        'surfaces event IDs.',
    ),
};

const getEventDescription =
  'Fetch a single event by ID from the authenticated org. Returns the full event object ' +
  'including event_type_name (derived from event_type_id), title, notes, timestamps, who ' +
  'triggered the event, linked project, and linked contact (if applicable). Use this when you ' +
  "have an event ID from get_project's events_data and want richer details (for example " +
  'team_members, action linkage, is_all_day flag), or when investigating a specific event in ' +
  'detail. Events are categorized by event_type_id, which maps to a human-readable name via ' +
  'event_type_name. Common types: 56 (Project Stage Changed), 2 (Customer Viewed Online ' +
  'Proposal), 44 (System Changed), 103/104 (Project Marked Sold/Installed). Finance and ' +
  'Docusign event types (49-75) cover the financing workflow; payment event types (109-123) ' +
  'cover invoicing and payments. For external integrations (Sungage, DocuSign), the `who` ' +
  'field may show "Unknown User"/"Unknown Email" since the event was fired by an external ' +
  'system, not by an OpenSolar user. If event_type_id maps to an unknown type (OpenSolar adds ' +
  'new types over time), event_type_name returns "Unknown event type" rather than failing. If ' +
  'contact_data is present on the event, sensitive PII fields (passport_number, ' +
  'licence_number, date_of_birth) are redacted before reaching the LLM. Note: events have no ' +
  '`created_by` field; the `user` URL on the event points at the user who created it.';

function enrichEventContactData(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  const parsed = ContactSchema.safeParse(value);
  if (!parsed.success) {
    return value;
  }
  return enrichContact(parsed.data as Contact);
}

export function registerEventsToolset(server: McpServer, ctx: EventsContext): void {
  server.registerTool(
    'get_event',
    {
      description: getEventDescription,
      inputSchema: getEventInputShape,
    },
    async ({ event_id }) => {
      const path = `orgs/${ctx.orgId}/events/${event_id}/`;
      const raw = await ctx.client.get(path);
      const event = EventSchema.parse(raw);

      const { url: _url, org: _org, ...rest } = event;
      const enrichedContact = enrichEventContactData(event.contact_data);

      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        payload[key] = value;
        if (key === 'event_type_id') {
          payload.event_type_name = getEventTypeName(event.event_type_id);
        }
        if (key === 'contact_data') {
          payload.contact_data = enrichedContact;
        }
      }
      if (!Object.hasOwn(payload, 'event_type_name')) {
        payload.event_type_name = getEventTypeName(event.event_type_id);
      }
      if (
        !Object.hasOwn(payload, 'contact_data') &&
        enrichedContact !== null &&
        enrichedContact !== undefined
      ) {
        payload.contact_data = enrichedContact;
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}
