import { messageForOpenSolarError } from '../client/errors.js';
import { OpenSolarApiError, type OpenSolarClient } from '../client/index.js';
import type { PreflightProjectShare, ShareResource } from '../schemas/project-share-preflight.js';

const LIST_PAGE_SIZE = 100;
const CONNECTION_MAX_PAGES = 3;
const SHARED_ENTITY_MAX_PAGES = 3;
const SYSTEMS_PAGE_SIZE = 100;
const PARTNER_ORG_ID = /\/orgs\/(\d+)\/?$/;
const PRICING_SCHEME_ID = /\/pricing_schemes\/(\d+)\/?$/;
const COSTING_ID = /\/costings\/(\d+)\/?$/;
const PAYMENT_OPTION_ID = /\/payment_options\/(\d+)\/?$/;

const RESOURCE_ORDER = [
  'payment_option',
  'pricing_scheme',
  'costing',
  'component_module_activation',
  'component_inverter_activation',
  'component_battery_activation',
  'component_other_activation',
] as const satisfies readonly ShareResource[];

const SHARED_LISTS = {
  payment_option: 'payment_options',
  pricing_scheme: 'pricing_schemes',
  costing: 'costings',
  component_module_activation: 'component_module_activations',
} as const satisfies Partial<Record<ShareResource, string>>;

type Reference = {
  referenced: 'yes' | 'no' | 'unknown';
  ids: number[];
  complete: boolean;
  gap?: string;
};

type ConnectionMatch = {
  id: number;
  is_active: boolean | null;
  is_other_active: boolean | null;
  is_other_enabled: boolean | null;
};

export async function loadProjectSharePreflight(
  client: OpenSolarClient,
  orgId: number,
  projectId: number,
  targetOrgId: number,
): Promise<PreflightProjectShare> {
  const [projectRead, systemsRead, connection] = await Promise.all([
    readJson(client, `orgs/${orgId}/projects/${projectId}/`),
    readJson(
      client,
      `orgs/${orgId}/systems/?fieldset=list&project=${projectId}&page=1&limit=${SYSTEMS_PAGE_SIZE}`,
    ),
    findConnection(client, orgId, targetOrgId),
  ]);

  const project = projectRead.record;
  const systems = Array.isArray(systemsRead.body) ? systemsRead.body : null;
  const systemsGap =
    systemsRead.gap ??
    (systems === null ? 'Systems payload did not match the documented shape' : undefined);
  const systemsComplete = systems !== null && systems.length < SYSTEMS_PAGE_SIZE;

  return {
    project_id: projectId,
    target_org_id: targetOrgId,
    connection,
    project_share: projectShare(project, projectRead.gap, targetOrgId),
    systems_list_complete: systemsComplete,
    resources: await Promise.all(
      RESOURCE_ORDER.map((resource) =>
        resourceRow(
          client,
          orgId,
          targetOrgId,
          resource,
          project,
          projectRead.gap,
          systems,
          systemsGap,
          systemsComplete,
        ),
      ),
    ),
  };
}

async function findConnection(
  client: OpenSolarClient,
  orgId: number,
  targetOrgId: number,
): Promise<PreflightProjectShare['connection']> {
  const matches: ConnectionMatch[] = [];
  let listComplete = false;
  for (let page = 1; page <= CONNECTION_MAX_PAGES; page += 1) {
    const path = `orgs/${orgId}/connected_orgs/?fieldset=list&page=${page}&limit=${LIST_PAGE_SIZE}`;
    let body: unknown;
    try {
      body = await client.get(path);
    } catch (error) {
      if (error instanceof OpenSolarApiError) {
        return connectionUnknown(matches, messageForOpenSolarError(error));
      }
      throw error;
    }
    if (!Array.isArray(body)) {
      return connectionUnknown(matches, 'Connected org list was not an array.');
    }
    for (const item of body) {
      const match = connectionMatch(item, targetOrgId);
      if (match !== null) {
        matches.push(match);
      }
    }
    if (body.length < LIST_PAGE_SIZE) {
      listComplete = true;
      break;
    }
  }
  return connectionStatus(matches, listComplete);
}

function connectionStatus(
  matches: ConnectionMatch[],
  listComplete: boolean,
): PreflightProjectShare['connection'] {
  if (!listComplete && matches.length < 2) {
    return connectionUnknown(matches);
  }
  if (matches.length === 0) {
    return { status: 'not_connected', list_complete: true };
  }
  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      connection_ids: matches.map((match) => match.id),
      list_complete: listComplete,
    };
  }
  const match = matches[0];
  if (match === undefined) {
    return connectionUnknown(matches, undefined, listComplete);
  }
  return {
    status: connectionReadiness(match),
    connection_id: match.id,
    is_active: match.is_active,
    is_other_active: match.is_other_active,
    is_other_enabled: match.is_other_enabled,
    list_complete: true,
  };
}

function connectionReadiness(match: ConnectionMatch): 'ready' | 'not_ready' | 'unknown' {
  const flags = [match.is_active, match.is_other_active, match.is_other_enabled];
  if (flags.some((value) => value === false)) {
    return 'not_ready';
  }
  if (flags.every((value) => value === true)) {
    return 'ready';
  }
  return 'unknown';
}

function connectionUnknown(
  matches: ConnectionMatch[],
  gap?: string,
  listComplete = false,
): PreflightProjectShare['connection'] {
  const connection: PreflightProjectShare['connection'] = {
    status: 'unknown',
    list_complete: listComplete,
  };
  if (matches.length === 1 && matches[0] !== undefined) {
    connection.connection_id = matches[0].id;
    connection.is_active = matches[0].is_active;
    connection.is_other_active = matches[0].is_other_active;
    connection.is_other_enabled = matches[0].is_other_enabled;
  }
  if (matches.length > 1) {
    connection.connection_ids = matches.map((match) => match.id);
  }
  if (gap !== undefined) {
    connection.gap = gap;
  }
  return connection;
}

function projectShare(
  project: Record<string, unknown> | null,
  gap: string | undefined,
  targetOrgId: number,
): PreflightProjectShare['project_share'] {
  if (gap !== undefined || project === null) {
    return gap === undefined ? { status: 'unknown' } : { status: 'unknown', gap };
  }
  if (!Object.hasOwn(project, 'shared_with') || !Array.isArray(project.shared_with)) {
    return { status: 'unknown' };
  }
  const flags: Array<boolean | undefined> = [];
  for (const entry of project.shared_with) {
    const record = objectRecord(entry);
    if (record === null || record.org_id !== targetOrgId) {
      continue;
    }
    flags.push(typeof record.is_shared === 'boolean' ? record.is_shared : undefined);
  }
  if (flags.length === 0) {
    return { status: 'not_shared' };
  }
  if (flags.some((flag) => flag === undefined) || new Set(flags).size > 1) {
    return { status: 'unknown' };
  }
  return { status: flags[0] === true ? 'shared' : 'not_shared' };
}

async function resourceRow(
  client: OpenSolarClient,
  orgId: number,
  targetOrgId: number,
  resource: ShareResource,
  project: Record<string, unknown> | null,
  projectGap: string | undefined,
  systems: unknown[] | null,
  systemsGap: string | undefined,
  systemsComplete: boolean,
): Promise<PreflightProjectShare['resources'][number]> {
  const reference = referenceFor(
    resource,
    project,
    projectGap,
    systems,
    systemsGap,
    systemsComplete,
  );
  const row: PreflightProjectShare['resources'][number] = {
    resource,
    referenced: reference.referenced,
    ids: reference.ids,
    share: 'unknown',
  };
  if (reference.gap !== undefined) {
    row.gap = reference.gap;
  }
  const segment = sharedListSegment(resource);
  if (segment === undefined || reference.ids.length === 0 || !reference.complete) {
    return row;
  }
  const membership = await sharedMembership(client, orgId, targetOrgId, segment, reference.ids);
  row.share = membership.share;
  row.shared_ids = membership.shared_ids;
  if (membership.missing_share_ids !== undefined) {
    row.missing_share_ids = membership.missing_share_ids;
  }
  if (membership.gap !== undefined) {
    row.gap = membership.gap;
  }
  return row;
}

async function sharedMembership(
  client: OpenSolarClient,
  orgId: number,
  targetOrgId: number,
  segment: string,
  ids: number[],
): Promise<{
  share: 'shared' | 'not_shared' | 'partially_shared' | 'unknown';
  shared_ids: number[];
  missing_share_ids?: number[];
  gap?: string;
}> {
  const wanted = new Set(ids);
  const seen = new Set<number>();
  let complete = false;
  for (let page = 1; page <= SHARED_ENTITY_MAX_PAGES; page += 1) {
    const path = `orgs/${orgId}/${segment}/?fieldset=list&shared_with=${targetOrgId}&page=${page}&limit=${LIST_PAGE_SIZE}`;
    let body: unknown;
    try {
      body = await client.get(path);
    } catch (error) {
      if (error instanceof OpenSolarApiError) {
        return unknownMembership(ids, seen, messageForOpenSolarError(error));
      }
      throw error;
    }
    if (!Array.isArray(body)) {
      return unknownMembership(ids, seen, 'Shared entity list was not an array.');
    }
    for (const item of body) {
      const record = objectRecord(item);
      const id = record === null ? null : positive(record.id);
      if (id !== null && wanted.has(id)) {
        seen.add(id);
      }
    }
    if (seen.size === wanted.size) {
      return decidedMembership(ids, seen);
    }
    if (body.length < LIST_PAGE_SIZE) {
      complete = true;
      break;
    }
  }
  if (!complete) {
    return unknownMembership(ids, seen);
  }
  return decidedMembership(ids, seen);
}

function decidedMembership(
  ids: number[],
  seen: Set<number>,
): {
  share: 'shared' | 'not_shared' | 'partially_shared';
  shared_ids: number[];
  missing_share_ids: number[];
} {
  const sharedIds = ids.filter((id) => seen.has(id));
  const missingIds = ids.filter((id) => !seen.has(id));
  if (missingIds.length === 0) {
    return { share: 'shared', shared_ids: sharedIds, missing_share_ids: missingIds };
  }
  if (sharedIds.length === 0) {
    return { share: 'not_shared', shared_ids: sharedIds, missing_share_ids: missingIds };
  }
  return { share: 'partially_shared', shared_ids: sharedIds, missing_share_ids: missingIds };
}

function unknownMembership(
  ids: number[],
  seen: Set<number>,
  gap?: string,
): {
  share: 'unknown';
  shared_ids: number[];
  gap?: string;
} {
  const membership: { share: 'unknown'; shared_ids: number[]; gap?: string } = {
    share: 'unknown',
    shared_ids: ids.filter((id) => seen.has(id)),
  };
  if (gap !== undefined) {
    membership.gap = gap;
  }
  return membership;
}

function sharedListSegment(resource: ShareResource): string | undefined {
  switch (resource) {
    case 'payment_option':
    case 'pricing_scheme':
    case 'costing':
    case 'component_module_activation':
      return SHARED_LISTS[resource];
    default:
      return undefined;
  }
}

function referenceFor(
  resource: ShareResource,
  project: Record<string, unknown> | null,
  projectGap: string | undefined,
  systems: unknown[] | null,
  systemsGap: string | undefined,
  systemsComplete: boolean,
): Reference {
  if (resource === 'payment_option') {
    return fieldReference(project, projectGap, 'payment_option_sold', PAYMENT_OPTION_ID);
  }
  if (resource === 'costing') {
    return costingReference(project, projectGap);
  }
  if (resource === 'pricing_scheme') {
    return systemsReference(systems, systemsGap, systemsComplete, pricingSchemeId);
  }
  if (resource === 'component_module_activation') {
    return systemsReference(systems, systemsGap, systemsComplete, moduleActivationId);
  }
  return { referenced: 'unknown', ids: [], complete: false };
}

function fieldReference(
  project: Record<string, unknown> | null,
  gap: string | undefined,
  key: string,
  pattern: RegExp,
): Reference {
  if (gap !== undefined || project === null) {
    return {
      referenced: 'unknown',
      ids: [],
      complete: false,
      ...(gap === undefined ? {} : { gap }),
    };
  }
  if (!Object.hasOwn(project, key)) {
    return { referenced: 'unknown', ids: [], complete: false };
  }
  return valueReference(project[key], pattern);
}

function costingReference(
  project: Record<string, unknown> | null,
  gap: string | undefined,
): Reference {
  if (gap !== undefined || project === null) {
    return {
      referenced: 'unknown',
      ids: [],
      complete: false,
      ...(gap === undefined ? {} : { gap }),
    };
  }
  const costing = Object.hasOwn(project, 'costing')
    ? valueReference(project.costing, COSTING_ID)
    : unknownReference();
  const override = Object.hasOwn(project, 'costing_override')
    ? valueReference(project.costing_override, COSTING_ID)
    : unknownReference();
  if (costing.referenced === 'no' && override.referenced === 'no') {
    return { referenced: 'no', ids: [], complete: true };
  }
  const ids = uniqueIds([...costing.ids, ...override.ids]);
  if (costing.referenced === 'yes' || override.referenced === 'yes') {
    return {
      referenced: 'yes',
      ids,
      complete: costing.complete && override.complete,
      ...(!costing.complete || !override.complete
        ? { gap: 'Costing references are incomplete; sharing cannot be confirmed.' }
        : {}),
    };
  }
  return { referenced: 'unknown', ids, complete: false };
}

function systemsReference(
  systems: unknown[] | null,
  gap: string | undefined,
  complete: boolean,
  readId: (system: Record<string, unknown>) => number[],
): Reference {
  if (gap !== undefined || systems === null) {
    return {
      referenced: 'unknown',
      ids: [],
      complete: false,
      ...(gap === undefined ? {} : { gap }),
    };
  }
  const ids: number[] = [];
  for (const system of systems) {
    const record = objectRecord(system);
    if (record !== null) {
      ids.push(...readId(record));
    }
  }
  const unique = uniqueIds(ids);
  if (unique.length > 0) {
    return {
      referenced: 'yes',
      ids: unique,
      complete,
      ...(!complete
        ? { gap: 'Systems list is incomplete; additional referenced resources may exist.' }
        : {}),
    };
  }
  if (!complete) {
    return { referenced: 'unknown', ids: [], complete: false };
  }
  return { referenced: 'no', ids: [], complete: true };
}

function valueReference(value: unknown, pattern: RegExp): Reference {
  if (value === null) {
    return emptyReference();
  }
  const id = entityId(value, pattern);
  if (id !== null) {
    return { referenced: 'yes', ids: [id], complete: true };
  }
  return {
    referenced: 'yes',
    ids: [],
    complete: false,
    gap: 'Referenced resource id could not be resolved.',
  };
}

function emptyReference(): Reference {
  return { referenced: 'no', ids: [], complete: true };
}

function unknownReference(): Reference {
  return { referenced: 'unknown', ids: [], complete: false };
}

function pricingSchemeId(system: Record<string, unknown>): number[] {
  const id = entityId(system.pricing_scheme, PRICING_SCHEME_ID);
  return id === null ? [] : [id];
}

function moduleActivationId(system: Record<string, unknown>): number[] {
  if (!Array.isArray(system.modules)) {
    return [];
  }
  const ids: number[] = [];
  for (const moduleRow of system.modules) {
    const record = objectRecord(moduleRow);
    const id = record === null ? null : positive(record.module_activation_id);
    if (id !== null) {
      ids.push(id);
    }
  }
  return ids;
}

function connectionMatch(value: unknown, targetOrgId: number): ConnectionMatch | null {
  const record = objectRecord(value);
  const id = record === null ? null : positive(record.id);
  const partnerOrgId = record === null ? null : entityId(record.org_to, PARTNER_ORG_ID);
  if (record === null || id === null || partnerOrgId !== targetOrgId) {
    return null;
  }
  return {
    id,
    is_active: flag(record.is_active),
    is_other_active: flag(record.is_other_active),
    is_other_enabled: flag(record.is_other_enabled),
  };
}

function entityId(value: unknown, pattern: RegExp): number | null {
  const direct = positive(value);
  if (direct !== null) {
    return direct;
  }
  if (typeof value === 'string') {
    const match = pattern.exec(value);
    return match?.[1] === undefined ? null : positive(Number(match[1]));
  }
  const record = objectRecord(value);
  return record === null ? null : positive(record.id);
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

async function readJson(
  client: OpenSolarClient,
  path: string,
): Promise<{ body: unknown; record: Record<string, unknown> | null; gap?: string }> {
  try {
    const body = await client.get(path);
    return { body, record: objectRecord(body) };
  } catch (error) {
    if (error instanceof OpenSolarApiError) {
      return { body: null, record: null, gap: messageForOpenSolarError(error) };
    }
    throw error;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}
