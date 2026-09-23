import { describe, expect, it } from 'vitest';
import { createClient, OpenSolarApiError } from '../../src/client/index.js';
import { loadConfig } from '../../src/lib/config.js';
import { hasLiveOpenSolarCredentials, loadLocalEnv } from '../load-local-env.js';

loadLocalEnv();

const live = hasLiveOpenSolarCredentials();

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('expected a JSON object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('expected a JSON array');
  }
  return value;
}

function numericId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function familyName(value: unknown): string {
  const family = asRecord(value).family_name;
  return typeof family === 'string' ? family : '';
}

function contactIds(value: unknown): number[] {
  return asArray(value).map((row) => {
    const id = numericId(asRecord(row).id);
    if (id === undefined) {
      throw new Error('contact row missing id');
    }
    return id;
  });
}

function eventIdFromProject(value: unknown): number | undefined {
  const events = asRecord(value).events_data;
  if (!Array.isArray(events)) {
    return undefined;
  }
  for (const event of events) {
    if (typeof event !== 'object' || event === null) {
      continue;
    }
    const id = numericId((event as Record<string, unknown>).id);
    if (id !== undefined) {
      return id;
    }
  }
  return undefined;
}

describe.skipIf(!live)('live OpenSolar', () => {
  it('reads the configured org with credentials from .env.local', async () => {
    const config = loadConfig();
    const client = createClient({
      token: config.OPENSOLAR_API_TOKEN,
      baseUrl: config.BASE_URL,
    });
    const org = await client.get(`orgs/${config.OPENSOLAR_ORG_ID}/`);

    expect(org).toEqual(expect.objectContaining({ id: config.OPENSOLAR_ORG_ID }));
  });

  it('GET orgs/{org}/events/{id}/ returns an event from project events_data', async (ctx) => {
    const config = loadConfig();
    const client = createClient({
      token: config.OPENSOLAR_API_TOKEN,
      baseUrl: config.BASE_URL,
    });
    const projects = asArray(
      await client.get(`orgs/${config.OPENSOLAR_ORG_ID}/projects/?limit=20`),
    );
    let eventId: number | undefined;
    for (const row of projects) {
      const projectId = numericId(asRecord(row).id);
      if (projectId === undefined) {
        continue;
      }
      const detail = await client.get(`orgs/${config.OPENSOLAR_ORG_ID}/projects/${projectId}/`);
      eventId = eventIdFromProject(detail);
      if (eventId !== undefined) {
        break;
      }
    }
    if (eventId === undefined) {
      ctx.skip();
      return;
    }

    try {
      const event = asRecord(
        await client.get(`orgs/${config.OPENSOLAR_ORG_ID}/events/${eventId}/`),
      );
      expect(event.id).toBe(eventId);
    } catch (error) {
      if (error instanceof OpenSolarApiError && error.status === 404) {
        throw new Error(
          `GET orgs/${config.OPENSOLAR_ORG_ID}/events/${eventId}/ returned 404; record in source-log, do not invent a path`,
        );
      }
      throw error;
    }
  });

  it('orders contacts by -family_name descending and ignores ordering=-id', async () => {
    const config = loadConfig();
    const client = createClient({
      token: config.OPENSOLAR_API_TOKEN,
      baseUrl: config.BASE_URL,
    });
    const orgPath = `orgs/${config.OPENSOLAR_ORG_ID}/contacts/`;
    const defaultPage = await client.get(`${orgPath}?limit=20`);
    const descendingFamily = asArray(await client.get(`${orgPath}?limit=20&ordering=-family_name`));
    const ignoredIdOrder = await client.get(`${orgPath}?limit=20&ordering=-id`);

    const names = descendingFamily.map(familyName);
    for (let index = 1; index < names.length; index += 1) {
      const previous = names[index - 1] ?? '';
      const current = names[index] ?? '';
      expect(
        previous.localeCompare(current, undefined, { sensitivity: 'base' }),
      ).toBeGreaterThanOrEqual(0);
    }
    expect(contactIds(ignoredIdOrder)).toEqual(contactIds(defaultPage));
  });
});
