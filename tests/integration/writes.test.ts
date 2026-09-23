import { describe, expect, it } from 'vitest';
import { OpenSolarApiError } from '../../src/client/index.js';
import { liveOpenSolarClient, liveOrgId, liveReads, liveWrites } from './support.js';

function contactId(value: unknown): number {
  if (typeof value !== 'object' || value === null || !('id' in value)) {
    throw new Error('contact response missing id');
  }
  const id = value.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new Error('contact response missing id');
  }
  return id;
}

function contactText(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const field = Object.fromEntries(Object.entries(value))[key];
  return typeof field === 'string' ? field : null;
}

describe.skipIf(!liveReads)('live OpenSolar writes', () => {
  it('creates, updates, and deletes one fixture contact', async (ctx) => {
    if (!liveWrites) {
      ctx.skip('OPENSOLAR_INTEGRATION_WRITES is not 1');
      return;
    }
    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const body = {
      first_name: 'Fixture',
      family_name: 'Contact',
      email: `opensolar-mcp-p3-06-${Date.now()}@example.test`,
      phone: '2025550197',
    };

    let createdId: number | undefined;
    try {
      createdId = contactId(await client.post(`orgs/${orgId}/contacts`, body));
      const updatedId = contactId(
        await client.put(`orgs/${orgId}/contacts/${createdId}`, {
          ...body,
          phone: '2025550196',
        }),
      );
      expect(updatedId).toBe(createdId);
    } catch (error) {
      if (error instanceof OpenSolarApiError) {
        throw new Error(`contact write failed with HTTP ${error.status}`);
      }
      throw error;
    } finally {
      if (createdId !== undefined) {
        await client.delete(`orgs/${orgId}/contacts/${createdId}`);
      }
    }
  });

  it('checks whether a phone-only PUT preserves the other supported fields', async (ctx) => {
    if (!liveWrites) {
      ctx.skip('OPENSOLAR_INTEGRATION_WRITES is not 1');
      return;
    }
    const client = liveOpenSolarClient();
    const orgId = liveOrgId();
    const stamp = Date.now();
    const created = {
      first_name: `E2${stamp}`,
      family_name: 'PutProbe',
      email: `opensolar-mcp-e2-${stamp}@example.test`,
      phone: '2025550101',
    };
    const nextPhone = '2025550102';
    let createdId: number | undefined;
    try {
      createdId = contactId(await client.post(`orgs/${orgId}/contacts`, created));
      const before = await client.get(`orgs/${orgId}/contacts/${createdId}/`);
      await client.put(`orgs/${orgId}/contacts/${createdId}`, { phone: nextPhone });
      const after = await client.get(`orgs/${orgId}/contacts/${createdId}/`);
      expect({
        phoneChanged: contactText(after, 'phone') !== contactText(before, 'phone'),
        firstNamePreserved: contactText(after, 'first_name') === contactText(before, 'first_name'),
        familyNamePreserved:
          contactText(after, 'family_name') === contactText(before, 'family_name'),
        emailPreserved: contactText(after, 'email') === contactText(before, 'email'),
      }).toEqual({
        phoneChanged: true,
        firstNamePreserved: true,
        familyNamePreserved: true,
        emailPreserved: true,
      });
    } finally {
      if (createdId !== undefined) {
        await client.delete(`orgs/${orgId}/contacts/${createdId}`);
      }
    }
  });
});
