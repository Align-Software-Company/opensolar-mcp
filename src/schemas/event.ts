import { z } from 'zod';
import { enrichContact } from '../lib/contact-enrich.js';
import { getEventTypeName } from '../lib/enums/event-types.js';
import { type Contact, ContactSchema } from './contact.js';

export const WhoSchema = z
  .object({
    display: z.string().nullish(),
    email: z.string().nullish(),
    portrait_image_public_url: z.string().nullish(),
  })
  .passthrough();

export const EventSchema = z
  .object({
    id: z.number(),
    event_type_id: z.number(),
    title: z.string().nullish(),
    notes: z.string().nullish(),
    start: z.string().nullish(),
    end: z.string().nullish(),
    created_date: z.string().nullish(),
    modified_date: z.string().nullish(),
    who: WhoSchema.nullish(),
    project_id: z.number().optional(),
    project: z.string().optional(),
    project_name: z.string().nullish(),
    contact_data: z.unknown().optional(),
    is_archived: z.boolean().optional(),
    is_complete: z.boolean().optional(),
    duration: z.number().nullish(),
  })
  .passthrough();

export type Event = z.infer<typeof EventSchema>;

type EnrichedContact = ReturnType<typeof enrichContact>;

export type CuratedWho = {
  display: string | null | undefined;
  email: string | null | undefined;
};

export type CuratedProjectEvent = {
  id: number;
  event_type_id: number;
  event_type_name: string;
  title: string | null | undefined;
  notes: string | null | undefined;
  start: string | null | undefined;
  end?: string;
  created_date: string | null | undefined;
  who: CuratedWho | null;
  contact_data: EnrichedContact | null;
  is_archived?: boolean;
  is_complete?: boolean;
  project_id?: number;
  duration?: number;
};

function enrichEventContactData(value: unknown): EnrichedContact | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = ContactSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return enrichContact(parsed.data as Contact);
}

export function curateProjectEvent(event: Event): CuratedProjectEvent {
  const eventTypeId = event.event_type_id;
  const eventTypeName = getEventTypeName(eventTypeId);

  const who: CuratedWho | null = event.who
    ? { display: event.who.display, email: event.who.email }
    : null;

  const curated: CuratedProjectEvent = {
    id: event.id,
    event_type_id: eventTypeId,
    event_type_name: eventTypeName,
    title: event.title,
    notes: event.notes,
    start: event.start,
    created_date: event.created_date,
    who,
    contact_data: enrichEventContactData(event.contact_data),
  };

  if (event.is_archived !== undefined) {
    curated.is_archived = event.is_archived;
  }
  if (event.is_complete !== undefined) {
    curated.is_complete = event.is_complete;
  }
  if (event.project_id !== undefined) {
    curated.project_id = event.project_id;
  }

  if (
    event.end !== null &&
    event.end !== undefined &&
    event.end !== '' &&
    event.end !== event.start
  ) {
    curated.end = event.end;
  }

  if (event.duration !== null && event.duration !== undefined && event.duration !== 0) {
    curated.duration = event.duration;
  }

  return curated;
}
