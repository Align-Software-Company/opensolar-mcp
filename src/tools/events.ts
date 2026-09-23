import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { openSolarSuccess, runOpenSolarTool } from '../client/errors.js';
import type { OpenSolarClient } from '../client/index.js';
import { enrichContact } from '../lib/contact-enrich.js';
import { EVENT_TYPES, getEventTypeName } from '../lib/enums/event-types.js';
import type { ToolName } from '../lib/tier-policy.js';
import { type Contact, ContactSchema } from '../schemas/contact.js';
import { EventSchema, GetEventOutputSchema } from '../schemas/event.js';

export interface EventsContext {
  client: OpenSolarClient;
  orgId: number;
}

const getEventInputSchema = z.object({
  event_id: z
    .number()
    .int()
    .positive()
    .describe(
      "OpenSolar event ID. Get this from get_project's events, or from another tool that " +
        'surfaces event IDs.',
    ),
});

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

const ListEventTypesOutputSchema = z.object({
  event_types: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
    }),
  ),
});

export function registerEventsToolset(
  server: McpServer,
  ctx: EventsContext,
  enabled: ReadonlySet<ToolName>,
): void {
  if (enabled.has('get_event')) {
    registerGetEvent(server, ctx);
  }
  if (enabled.has('list_event_types')) {
    registerListEventTypes(server);
  }
}

function registerGetEvent(server: McpServer, ctx: EventsContext): void {
  server.registerTool(
    'get_event',
    {
      title: 'Get event',
      description:
        'Returns one event by id. Adds `event_type_name` and omits `url` and `org`. ' +
        'Use an id from get_project events. Unknown types become `Unknown event type`.',
      inputSchema: getEventInputSchema,
      outputSchema: GetEventOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ event_id }) =>
      runOpenSolarTool(async () => {
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

        const parsed = GetEventOutputSchema.parse(payload);
        const typeName = parsed.event_type_name;
        return openSolarSuccess(parsed, `Event ${parsed.id}: ${typeName}.`);
      }),
  );
}

function registerListEventTypes(server: McpServer): void {
  server.registerTool(
    'list_event_types',
    {
      title: 'List event types',
      description:
        'Returns the OpenSolar event type ids and titles, including gaps. This is a copied docs table, not an API call.',
      inputSchema: z.object({}),
      outputSchema: ListEventTypesOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () =>
      runOpenSolarTool(async () => {
        const eventTypes = Object.entries(EVENT_TYPES).map(([id, title]) => ({
          id: Number(id),
          title,
        }));
        const payload = ListEventTypesOutputSchema.parse({ event_types: eventTypes });
        return openSolarSuccess(payload, `${payload.event_types.length} event types.`);
      }),
  );
}
