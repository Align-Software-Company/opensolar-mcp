export const CONTACT_MATCH_FIELDS = [
  'email',
  'phone',
  'full_name',
  'display',
  'first_name',
  'family_name',
] as const;

export const PROJECT_MATCH_FIELDS = [
  'contact_email',
  'contact_phone',
  'identifier',
  'address',
  'title',
  'business_name',
  'contact_name',
  'locality',
  'state',
  'zip',
] as const;

export const MATCH_TYPES = ['exact', 'prefix', 'contains'] as const;

export type ContactMatchField = (typeof CONTACT_MATCH_FIELDS)[number];
export type ProjectMatchField = (typeof PROJECT_MATCH_FIELDS)[number];
export type MatchType = (typeof MATCH_TYPES)[number];

export type ContactMatch = {
  field: ContactMatchField;
  type: MatchType;
};

export type ProjectMatch = {
  field: ProjectMatchField;
  type: MatchType;
};

export type MatchClass = 'none' | 'unique' | 'ambiguous';

const CONTACT_MATCH_ORDER: readonly ContactMatch[] = [
  { field: 'email', type: 'exact' },
  { field: 'phone', type: 'exact' },
  { field: 'full_name', type: 'exact' },
  { field: 'display', type: 'exact' },
  { field: 'first_name', type: 'exact' },
  { field: 'family_name', type: 'exact' },
  { field: 'full_name', type: 'prefix' },
  { field: 'display', type: 'prefix' },
  { field: 'first_name', type: 'prefix' },
  { field: 'family_name', type: 'prefix' },
  { field: 'full_name', type: 'contains' },
  { field: 'display', type: 'contains' },
  { field: 'first_name', type: 'contains' },
  { field: 'family_name', type: 'contains' },
  { field: 'email', type: 'contains' },
  { field: 'phone', type: 'contains' },
];

const PROJECT_MATCH_ORDER: readonly ProjectMatch[] = [
  { field: 'contact_email', type: 'exact' },
  { field: 'contact_phone', type: 'exact' },
  { field: 'identifier', type: 'exact' },
  { field: 'address', type: 'exact' },
  { field: 'title', type: 'exact' },
  { field: 'business_name', type: 'exact' },
  { field: 'contact_name', type: 'exact' },
  { field: 'locality', type: 'exact' },
  { field: 'state', type: 'exact' },
  { field: 'zip', type: 'exact' },
  { field: 'title', type: 'prefix' },
  { field: 'address', type: 'prefix' },
  { field: 'business_name', type: 'prefix' },
  { field: 'contact_name', type: 'prefix' },
  { field: 'locality', type: 'prefix' },
  { field: 'title', type: 'contains' },
  { field: 'address', type: 'contains' },
  { field: 'business_name', type: 'contains' },
  { field: 'contact_name', type: 'contains' },
  { field: 'locality', type: 'contains' },
  { field: 'state', type: 'contains' },
  { field: 'zip', type: 'contains' },
  { field: 'contact_email', type: 'contains' },
  { field: 'contact_phone', type: 'contains' },
];

const PHONE_CONTAINS_MIN_DIGITS = 7;

export type ContactMatchSource = {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  family_name?: string | null;
  display?: string | null;
};

export type ProjectContactSource = {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  family_name?: string | null;
  display?: string | null;
};

export type ProjectMatchSource = {
  title?: string | null;
  address?: string | null;
  identifier?: string | null;
  business_name?: string | null;
  locality?: string | null;
  state?: string | null;
  zip?: string | null;
  contacts?: readonly ProjectContactSource[];
};

export function contactMatchStrength(match: ContactMatch): number {
  return matchStrength(CONTACT_MATCH_ORDER, match);
}

export function projectMatchStrength(match: ProjectMatch): number {
  return matchStrength(PROJECT_MATCH_ORDER, match);
}

export function classifyMatches(count: number): MatchClass {
  if (count <= 0) {
    return 'none';
  }
  if (count === 1) {
    return 'unique';
  }
  return 'ambiguous';
}

export function foldText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function foldEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function rankContact(query: string, contact: ContactMatchSource): ContactMatch | null {
  const queryText = foldText(query);
  const queryEmail = foldEmail(query);
  const queryPhone = phoneDigits(query);
  const fullName = joinName(contact.first_name, contact.family_name);

  if (emailExact(queryEmail, contact.email)) {
    return { field: 'email', type: 'exact' };
  }
  if (phoneExact(queryPhone, contact.phone)) {
    return { field: 'phone', type: 'exact' };
  }
  if (textExact(queryText, fullName)) {
    return { field: 'full_name', type: 'exact' };
  }
  if (textExact(queryText, contact.display)) {
    return { field: 'display', type: 'exact' };
  }
  if (textExact(queryText, contact.first_name)) {
    return { field: 'first_name', type: 'exact' };
  }
  if (textExact(queryText, contact.family_name)) {
    return { field: 'family_name', type: 'exact' };
  }

  const prefixNames: Array<[ContactMatchField, string | null | undefined]> = [
    ['full_name', fullName],
    ['display', contact.display],
    ['first_name', contact.first_name],
    ['family_name', contact.family_name],
  ];
  for (const [field, value] of prefixNames) {
    if (textPrefix(queryText, value)) {
      return { field, type: 'prefix' };
    }
  }

  for (const [field, value] of prefixNames) {
    if (textContains(queryText, value)) {
      return { field, type: 'contains' };
    }
  }
  if (emailContains(queryEmail, contact.email)) {
    return { field: 'email', type: 'contains' };
  }
  if (phoneContains(queryPhone, contact.phone)) {
    return { field: 'phone', type: 'contains' };
  }
  return null;
}

export function rankProject(query: string, project: ProjectMatchSource): ProjectMatch | null {
  const queryText = foldText(query);
  const queryEmail = foldEmail(query);
  const queryPhone = phoneDigits(query);
  const contacts = project.contacts ?? [];

  for (const contact of contacts) {
    if (emailExact(queryEmail, contact.email)) {
      return { field: 'contact_email', type: 'exact' };
    }
  }
  for (const contact of contacts) {
    if (phoneExact(queryPhone, contact.phone)) {
      return { field: 'contact_phone', type: 'exact' };
    }
  }
  if (textExact(queryText, project.identifier)) {
    return { field: 'identifier', type: 'exact' };
  }
  if (textExact(queryText, project.address)) {
    return { field: 'address', type: 'exact' };
  }
  if (textExact(queryText, project.title)) {
    return { field: 'title', type: 'exact' };
  }
  if (textExact(queryText, project.business_name)) {
    return { field: 'business_name', type: 'exact' };
  }
  for (const contact of contacts) {
    if (textExact(queryText, contactName(contact))) {
      return { field: 'contact_name', type: 'exact' };
    }
  }
  if (textExact(queryText, project.locality)) {
    return { field: 'locality', type: 'exact' };
  }
  if (textExact(queryText, project.state)) {
    return { field: 'state', type: 'exact' };
  }
  if (textExact(queryText, project.zip)) {
    return { field: 'zip', type: 'exact' };
  }

  const prefixFields: Array<[ProjectMatchField, string | null | undefined]> = [
    ['title', project.title],
    ['address', project.address],
    ['business_name', project.business_name],
  ];
  for (const [field, value] of prefixFields) {
    if (textPrefix(queryText, value)) {
      return { field, type: 'prefix' };
    }
  }
  for (const contact of contacts) {
    if (textPrefix(queryText, contactName(contact))) {
      return { field: 'contact_name', type: 'prefix' };
    }
  }
  if (textPrefix(queryText, project.locality)) {
    return { field: 'locality', type: 'prefix' };
  }

  const containsFields: Array<[ProjectMatchField, string | null | undefined]> = [
    ['title', project.title],
    ['address', project.address],
    ['business_name', project.business_name],
    ['locality', project.locality],
    ['state', project.state],
    ['zip', project.zip],
  ];
  for (const [field, value] of containsFields) {
    if (textContains(queryText, value)) {
      return { field, type: 'contains' };
    }
  }
  for (const contact of contacts) {
    if (textContains(queryText, contactName(contact))) {
      return { field: 'contact_name', type: 'contains' };
    }
    if (emailContains(queryEmail, contact.email)) {
      return { field: 'contact_email', type: 'contains' };
    }
    if (phoneContains(queryPhone, contact.phone)) {
      return { field: 'contact_phone', type: 'contains' };
    }
  }
  return null;
}

function matchStrength<Field extends string>(
  order: readonly { field: Field; type: MatchType }[],
  match: { field: Field; type: MatchType },
): number {
  const index = order.findIndex(
    (candidate) => candidate.field === match.field && candidate.type === match.type,
  );
  return index === -1 ? order.length : index;
}

function contactName(contact: ProjectContactSource): string | null {
  const display = textOrNull(contact.display);
  if (display !== null) {
    return display;
  }
  return joinName(contact.first_name, contact.family_name);
}

function joinName(
  first: string | null | undefined,
  family: string | null | undefined,
): string | null {
  const parts = [textOrNull(first), textOrNull(family)].filter(
    (part): part is string => part !== null,
  );
  if (parts.length === 0) {
    return null;
  }
  return parts.join(' ');
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const folded = foldText(value);
  return folded.length > 0 ? value : null;
}

function textExact(queryText: string, value: string | null | undefined): boolean {
  const text = textOrNull(value);
  return queryText.length > 0 && text !== null && foldText(text) === queryText;
}

function textPrefix(queryText: string, value: string | null | undefined): boolean {
  const text = textOrNull(value);
  if (queryText.length === 0 || text === null) {
    return false;
  }
  const folded = foldText(text);
  return folded.startsWith(queryText) && folded !== queryText;
}

function textContains(queryText: string, value: string | null | undefined): boolean {
  const text = textOrNull(value);
  if (queryText.length === 0 || text === null) {
    return false;
  }
  const folded = foldText(text);
  return folded.includes(queryText) && !folded.startsWith(queryText);
}

function emailExact(queryEmail: string, value: string | null | undefined): boolean {
  if (!queryEmail.includes('@') || typeof value !== 'string') {
    return false;
  }
  const email = foldEmail(value);
  return email.includes('@') && email === queryEmail;
}

function emailContains(queryEmail: string, value: string | null | undefined): boolean {
  if (!queryEmail.includes('@') || typeof value !== 'string') {
    return false;
  }
  const email = foldEmail(value);
  return email.includes(queryEmail) && email !== queryEmail;
}

function phoneExact(queryPhone: string, value: string | null | undefined): boolean {
  if (queryPhone.length === 0 || typeof value !== 'string') {
    return false;
  }
  const phone = phoneDigits(value);
  return phone.length > 0 && phone === queryPhone;
}

function phoneContains(queryPhone: string, value: string | null | undefined): boolean {
  if (queryPhone.length < PHONE_CONTAINS_MIN_DIGITS || typeof value !== 'string') {
    return false;
  }
  const phone = phoneDigits(value);
  return phone.includes(queryPhone) && phone !== queryPhone;
}
